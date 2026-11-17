import http from 'node:http';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { watch as fsWatch, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import {
  MODELS, SAMPLE_RATE, setupEnv, transcribeFile, buildAllFormats,
  translateCues, isTranslationSupported, clearModelCaches,
} from './transcribe.js';
import { cuesToSrt } from './srt.js';
import { cuesToVtt, cuesToAss, buildChapters, chaptersToText } from './subs.js';

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = existsSync(path.join(__dirname, 'public-ui'))
  ? path.join(__dirname, 'public-ui')
  : path.join(__dirname, 'public');
// In packaged (Electron) mode, writable dirs live in the user data dir
// because the install dir may be read-only / inside an asar archive.
const DATA_DIR = process.env.SCRIBEFLOW_DATA_DIR || __dirname;
const TMP_DIR = path.join(DATA_DIR, 'tmp');
const MODEL_CACHE = path.join(DATA_DIR, 'model-cache');
const SUBS_DIR = path.join(TMP_DIR, 'subs');
const folderWatchers = new Map(); // dir -> {dir, watcher, files, rescanTimer}
const PORT = process.env.PORT || 4732;

setupEnv(MODEL_CACHE);

const job = {
  busy: false,
  stage: 'idle',
  file: null,
  model: null,
  progress: null,
  block: null,
  totalBlocks: null,
};
let queueLength = 0;
let chain = Promise.resolve();

function setJob(patch) {
  Object.assign(job, patch);
}

function friendlyFfmpegError(e) {
  const stderr = e.stderr || '';
  if (/does not contain any stream/i.test(stderr)) return 'File has no audio stream';
  if (/invalid data|moov atom/i.test(stderr)) return 'File is corrupt or an unsupported format';
  if (/error opening input/i.test(stderr)) return 'Could not read file (unsupported or corrupt)';
  return `ffmpeg failed: ${(stderr.match(/error[^\n]*/i) || [e.message])[0].slice(0, 200)}`;
}

async function collectBody(req, limit = 8 * 1024 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('File too large (max ~8GB)');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function enqueue(fn) {
  queueLength++;
  const run = chain.then(fn).finally(() => { queueLength--; });
  chain = run.catch(() => {});
  return run;
}

async function runTranscribe(body, filename, params) {
  const modelKey = params.get('model') || 'base';
  const modelId = MODELS[modelKey];
  if (!modelId) throw new Error(`Unknown model "${modelKey}"`);

  const style = {
    maxCharsPerLine: parseInt(params.get('maxChars'), 10) || 42,
    maxWordsPerLine: parseInt(params.get('maxWords'), 10) || 0,
    maxLines: parseInt(params.get('maxLines'), 10) || 2,
    pauseSec: parseFloat(params.get('pauseSec')) || 0.7,
    ass: {
      fontName: params.get('assFont') || 'Arial',
      fontSize: parseInt(params.get('assSize'), 10) || 16,
      primaryColor: params.get('assColor') || 'white',
      alignment: parseInt(params.get('assPos'), 10) || 2,
      bold: params.get('assBold') === '1' ? 1 : 0,
    },
  };
  const dtype = ['q8', 'fp32', 'auto'].includes(params.get('dtype')) ? params.get('dtype') : 'auto';
  const device = ['auto', 'cpu', 'dml'].includes(params.get('device')) ? params.get('device') : 'auto';
  const language = params.get('language') || 'auto';
  const translateTo = params.get('translateTo') || 'none';

  const ext = path.extname(filename) || '.bin';
  setJob({ busy: true, stage: 'receiving', file: filename, model: modelKey, progress: null, block: null, totalBlocks: null });

  const dir = path.join(TMP_DIR, crypto.randomUUID().slice(0, 8));
  await mkdir(dir, { recursive: true });
  const inputPath = path.join(dir, `input${ext}`);
  await writeFile(inputPath, body);

  try {
    const { chunks, text } = await transcribeFile(inputPath, {
      modelId,
      language,
      dtype,
      device,
      tmpDir: TMP_DIR,
      onModelProgress: (p) => { job.progress = p; },
    }, (p) => {
      if (p.stage === 'transcribing') {
        setJob({ stage: 'transcribing', block: p.block, totalBlocks: p.totalBlocks });
      } else {
        setJob({ stage: p.stage });
      }
    });

    setJob({ stage: 'building-srt' });
    const formats = buildAllFormats(chunks, style);
    const chapters = buildChapters(formats.cues);

    // Optional translation pass (local opus-mt models).
    // For auto-detect, recover the language Whisper reported on the chunks.
    const detectedLang = chunks.find(c => c.language)?.language || language;
    let translated = null;
    if (isTranslationSupported(detectedLang, translateTo)) {
      setJob({ stage: 'translating' });
      const tcues = await translateCues(formats.cues, detectedLang, translateTo, (p) => {
        setJob({ stage: 'translating', cue: p.cue, totalCues: p.totalCues });
      });
      translated = {
        srt: cuesToSrt(tcues),
        vtt: cuesToVtt(tcues),
        ass: cuesToAss(tcues, style.ass),
        cues: tcues.map(c => ({ start: c.start, end: c.end, text: c.lines.join(' ') })),
      };
    }

    return {
      filename: filename.replace(/\.[^.]+$/, '') + '.srt',
      srt: formats.srt,
      vtt: formats.vtt,
      ass: formats.ass,
      cues: formats.cues.map(c => ({ start: c.start, end: c.end, text: c.lines.join(' ') })),
      text,
      chunks: chunks.length,
      cueCount: formats.cues.length,
      chapters,
      chaptersText: chaptersToText(chapters),
      detectedLanguage: detectedLang,
      translated,
    };
  } catch (e) {
    if (e.stderr) throw new Error(friendlyFfmpegError(e));
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    setJob({ busy: false, stage: 'idle', progress: null, block: null, totalBlocks: null });
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };

  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(200, { ...job, queueLength, models: Object.keys(MODELS) });
    }

    if (req.method === 'GET' && url.pathname === '/api/models') {
      return send(200, MODELS);
    }

    if (req.method === 'POST' && url.pathname === '/api/transcribe') {
      const filename = path.basename(url.searchParams.get('filename') || 'input');
      const body = await collectBody(req);
      if (!body.length) return send(400, { error: 'Empty upload' });
      const result = await enqueue(() => runTranscribe(body, filename, url.searchParams));
      return send(200, result);
    }

    // Store subtitle text temporarily (for burn-in)
    if (req.method === 'POST' && url.pathname === '/api/store-sub') {
      const id = crypto.randomUUID().slice(0, 8);
      await mkdir(SUBS_DIR, { recursive: true });
      await writeFile(path.join(SUBS_DIR, `${id}.srt`), await collectBody(req, 10 * 1024 * 1024));
      return send(200, { id });
    }

    // Burn subtitles into a video: body = video file, ?sub=<id>&filename=out.mp4
    if (req.method === 'POST' && url.pathname === '/api/burn') {
      const subId = url.searchParams.get('sub');
      const filename = path.basename(url.searchParams.get('filename') || 'output.mp4');
      if (!subId || !/^[a-z0-9-]+$/i.test(subId)) return send(400, { error: 'Missing sub id' });
      const subPath = path.join(SUBS_DIR, `${subId}.srt`);
      const body = await collectBody(req);
      if (!body.length) return send(400, { error: 'Empty upload' });

      const result = await enqueue(async () => {
        const dir = path.join(TMP_DIR, crypto.randomUUID().slice(0, 8));
        await mkdir(dir, { recursive: true });
        try {
          const inPath = path.join(dir, 'input' + (path.extname(filename) || '.mp4'));
          const outPath = path.join(dir, 'output.mp4');
          const localSub = path.join(dir, 'sub.srt');
          await writeFile(inPath, body);
          await copyFile(subPath, localSub);
          setJob({ busy: true, stage: 'burning', file: filename, model: null, progress: null });
          await execFileP(ffmpegPath, [
            '-y', '-i', inPath,
            '-vf', 'subtitles=sub.srt',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
            '-c:a', 'copy', outPath,
          ], { maxBuffer: 16 * 1024 * 1024, cwd: dir });
          return outPath;
        } catch (e) {
          await rm(dir, { recursive: true, force: true }).catch(() => {});
          if (e.stderr) throw new Error(friendlyFfmpegError(e));
          throw e;
        } finally {
          setJob({ busy: false, stage: 'idle', progress: null });
        }
      });

      // result is a temp path inside a dir we must not delete yet — read then cleanup
      const data = await readFile(result);
      const dir = path.dirname(result);
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename.replace(/\.mp4$/i, '')}-subbed.mp4"`,
      });
      return res.end(data);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/sub-file/')) {
      const id = path.basename(url.pathname.slice('/api/sub-file/'.length));
      if (!/^[a-z0-9-]+$/i.test(id)) return send(400, { error: 'Bad id' });
      try {
        const data = await readFile(path.join(SUBS_DIR, `${id}.srt`));
        return send(200, data, 'application/x-subrip');
      } catch {
        return send(404, { error: 'Not found' });
      }
    }

    // Clear model cache (and in-memory transcriber instances)
    if (req.method === 'POST' && url.pathname === '/api/cache/clear') {
      let body = '';
      for await (const c of req) body += c;
      const scope = (() => { try { return JSON.parse(body || '{}').scope || 'models'; } catch { return 'models'; } })();
      if (scope === 'models' || scope === 'all') {
        await rm(MODEL_CACHE, { recursive: true, force: true }).catch(() => {});
        await mkdir(MODEL_CACHE, { recursive: true });
        clearModelCaches();
      }
      if (scope === 'tmp' || scope === 'all') {
        await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
        await mkdir(TMP_DIR, { recursive: true });
        await mkdir(SUBS_DIR, { recursive: true });
      }
      return send(200, { ok: true, scope });
    }

    // Watch folder mode
    if (req.method === 'POST' && url.pathname === '/api/watch') {
      let body = '';
      for await (const c of req) body += c;
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch {}
      const dir = payload.path;
      if (payload.action === 'stop') {
        for (const w of folderWatchers.values()) w.close();
        folderWatchers.clear();
        return send(200, { ok: true });
      }
      if (payload.action !== 'start' || !dir) return send(400, { error: 'Need action=start and path' });
      try {
        const st = await stat(dir);
        if (!st.isDirectory()) throw new Error('not a directory');
      } catch {
        return send(400, { error: `Not a readable folder: ${dir}` });
      }
      for (const w of folderWatchers.values()) w.close();
      folderWatchers.clear();

      const MEDIA_EXT = /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma|mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i;
      const state = { dir, watcher: null, rescanTimer: null };
      const scan = async () => {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          state.files = [];
          for (const e of entries) {
            if (!e.isFile() || !MEDIA_EXT.test(e.name)) continue;
            const p = path.join(dir, e.name);
            const s = await stat(p).catch(() => null);
            if (s) state.files.push({ name: e.name, path: p, size: s.size, mtimeMs: s.mtimeMs });
          }
        } catch {}
      };
      state.files = [];
      await scan();
      state.watcher = fsWatch(dir, { persistent: false }, () => {
        clearTimeout(state.rescanTimer);
        state.rescanTimer = setTimeout(scan, 400);
      });
      folderWatchers.set(dir, state);
      return send(200, { ok: true, dir, count: state.files.length });
    }

    if (req.method === 'GET' && url.pathname === '/api/watch') {
      const dir = url.searchParams.get('dir');
      const states = [...folderWatchers.values()];
      const st = dir ? folderWatchers.get(dir) : states[0];
      if (!st) return send(200, { watching: false, files: [] });
      return send(200, { watching: true, dir: st.dir, files: st.files || [] });
    }

    // Stream a local media file (used by watch mode + shell "open with")
    if (req.method === 'GET' && url.pathname === '/api/local-file') {
      const p = url.searchParams.get('path');
      if (!p) return send(400, { error: 'Missing path' });
      const MEDIA_EXT = /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma|mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i;
      if (!MEDIA_EXT.test(p)) return send(403, { error: 'Not a media file' });
      try {
        const s = await stat(p);
        if (!s.isFile() || s.size > 8 * 1024 * 1024 * 1024) throw new Error('bad file');
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': s.size,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(p))}`,
        });
        const { createReadStream } = await import('node:fs');
        return createReadStream(p).pipe(res);
      } catch {
        return send(404, { error: 'File not found or unreadable' });
      }
    }

    // Static files
    if (req.method === 'GET') {
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
      if (!filePath.startsWith(PUBLIC_DIR)) return send(403, { error: 'Forbidden' });
      try {
        const data = await readFile(filePath);
        return send(200, data, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      } catch {
        return send(404, { error: 'Not found' }, 'text/plain');
      }
    }

    send(405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    setJob({ busy: false, stage: 'idle', progress: null, block: null, totalBlocks: null });
    send(500, { error: e.message || String(e) });
  }
});

await mkdir(TMP_DIR, { recursive: true });
await mkdir(SUBS_DIR, { recursive: true });
await mkdir(MODEL_CACHE, { recursive: true });

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Subtitle Studio running at ${url}`);
  console.log('First run downloads the Whisper model into ./model-cache');
  if (!process.env.NO_BROWSER) {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    execFile(cmd, [url], () => {});
  }
});
