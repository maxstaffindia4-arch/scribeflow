// Core transcription pipeline shared by server.js and cli.js.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import { env, pipeline } from '@huggingface/transformers';
import { buildCues, cuesToSrt, wrapText, normalizeOptions } from './srt.js';
import { cuesToVtt, cuesToAss } from './subs.js';

const execFileP = promisify(execFile);

export const MODELS = {
  'tiny': 'onnx-community/whisper-tiny_timestamped',
  'base': 'onnx-community/whisper-base_timestamped',
  'small': 'onnx-community/whisper-small_timestamped',
  'large-v3-turbo': 'onnx-community/whisper-large-v3-turbo_timestamped',
  'tiny.en': 'onnx-community/whisper-tiny.en_timestamped',
  'base.en': 'onnx-community/whisper-base.en_timestamped',
  'small.en': 'onnx-community/whisper-small.en_timestamped',
};

export const SAMPLE_RATE = 16000;
const BLOCK_SEC = 120; // transcribe in blocks for progress + memory safety

export function setupEnv(cacheDir) {
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
}

const transcriberCache = new Map(); // `${modelId}|${dtype}|${device}` -> Promise

export async function getTranscriber(modelId, { dtype = 'auto', device = 'auto', onProgress } = {}) {
  const dtypeAttempts = dtype === 'fp32' ? ['fp32'] : ['q8', 'fp32'];
  const deviceAttempts = device === 'cpu' ? ['cpu'] : device === 'dml' ? ['dml', 'cpu'] : ['dml', 'cpu'];
  const key = `${modelId}|${dtype}|${device}`;
  if (transcriberCache.has(key)) return transcriberCache.get(key);

  const promise = (async () => {
    let lastErr;
    for (const d of deviceAttempts) {
      for (const dt of dtypeAttempts) {
        try {
          const t = await pipeline('automatic-speech-recognition', modelId, {
            dtype: dt,
            device: d,
            progress_callback: onProgress,
          });
          console.log(`whisper loaded: ${modelId} dtype=${dt} device=${d}`);
          return t;
        } catch (e) {
          lastErr = e;
          console.warn(`load failed model=${modelId} dtype=${dt} device=${d}: ${e.message}`);
        }
      }
    }
    throw lastErr;
  })();

  transcriberCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    transcriberCache.delete(key);
    throw e;
  }
}

// ---- Translation (opus-mt via English pivot) -------------------------------

// X -> en models available on onnx-community
const SRC_TO_EN = new Set(['zh', 'es', 'de', 'it', 'fr', 'vi', 'nl', 'da', 'ar', 'sv', 'ru', 'fi', 'pl', 'ja', 'hi', 'th', 'cs', 'tr', 'id', 'ko', 'et', 'bat', 'gmw', 'gem']);
// en -> X models available on onnx-community
const EN_TARGETS = new Set(['es', 'fr', 'de', 'it', 'nl', 'ru', 'zh', 'ar', 'cs']);

export function clearModelCaches() {
  transcriberCache.clear();
  translatorCache.clear();
}

const translatorCache = new Map(); // modelId -> Promise

async function getTranslator(modelId, onProgress) {
  if (translatorCache.has(modelId)) return translatorCache.get(modelId);
  const p = pipeline('translation', modelId, { dtype: 'q8', progress_callback: onProgress })
    .catch((e) => {
      translatorCache.delete(modelId);
      throw e;
    });
  translatorCache.set(modelId, p);
  return p;
}

function modelToEnglish(src) {
  return SRC_TO_EN.has(src) ? `onnx-community/opus-mt-${src}-en` : 'onnx-community/opus-mt-mul-en';
}
function modelFromEnglish(tgt) {
  return `onnx-community/opus-mt-en-${tgt}`;
}

export function isTranslationSupported(src, tgt) {
  if (!tgt || tgt === 'none' || tgt === src) return false;
  if (src === 'en') return EN_TARGETS.has(tgt);
  // src -> en leg always available (mul-en fallback); en -> tgt must exist
  return EN_TARGETS.has(tgt) || tgt === 'en';
}

async function translateText(text, modelId, onProgress) {
  const t = await getTranslator(modelId, onProgress);
  const out = await t(text, { max_new_tokens: 256 });
  return (out?.translation_text || out?.[0]?.translation_text || '').trim();
}

// Translate cue texts to tgtLang. Source language is assumed 'en' unless
// srcLang is a real code; unknown/'auto' sources go through the mul-en pivot.
// Two-leg path: src -> en -> tgt. Returns new cue array, same timings.
export async function translateCues(cues, srcLang, tgtLang, onProgress) {
  const src = srcLang && srcLang !== 'auto' ? srcLang : 'en';
  const toEnglish = src !== 'en';
  const fromEnglish = tgtLang !== 'en';
  if (!toEnglish && !fromEnglish) return cues;

  const srcModel = toEnglish ? modelToEnglish(src) : null;
  const tgtModel = fromEnglish ? modelFromEnglish(tgtLang) : null;
  const o = normalizeOptions({ maxCharsPerLine: 42, maxLines: 2 });

  const out = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    let text = c.lines.join(' ');
    try {
      if (srcModel) text = await translateText(text, srcModel, onProgress);
      if (tgtModel) text = await translateText(text, tgtModel, onProgress);
    } catch (e) {
      console.warn(`translation failed for cue ${i}: ${e.message}`);
      text = c.lines.join(' ');
    }
    out.push({ ...c, text, lines: (wrapText(text, o) || text).split('\n') });
    onProgress?.({ stage: 'translating', cue: i + 1, totalCues: cues.length });
  }
  return out;
}

// ---- WAV parsing -----------------------------------------------------------

export function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    }
    if (id === 'data') data = { offset: body, size };
    offset = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV missing fmt/data chunk');
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV format (fmt=${fmt.audioFormat}, bits=${fmt.bitsPerSample})`);
  }
  if (fmt.sampleRate !== SAMPLE_RATE || fmt.channels !== 1) {
    throw new Error(`Expected ${SAMPLE_RATE}Hz mono WAV, got ${fmt.sampleRate}Hz ${fmt.channels}ch`);
  }
  const n = Math.floor(data.size / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(data.offset + i * 2) / 32768;
  return out;
}

// ---- Silence edge-trim (energy VAD) ----------------------------------------

export function trimSilenceEdges(pcm, { thresholdRatio = 0.12, minThreshold = 0.008, padSec = 0.25 } = {}) {
  const frame = 512;
  const hop = 256;
  const nFrames = Math.max(0, Math.floor((pcm.length - frame) / hop));
  if (nFrames < 10) return { pcm, offsetSec: 0 };

  const rms = new Float64Array(nFrames);
  let maxRms = 0;
  for (let i = 0; i < nFrames; i++) {
    let sum = 0;
    const base = i * hop;
    for (let j = 0; j < frame; j++) {
      const v = pcm[base + j];
      sum += v * v;
    }
    rms[i] = Math.sqrt(sum / frame);
    if (rms[i] > maxRms) maxRms = rms[i];
  }

  const thr = Math.max(minThreshold, maxRms * thresholdRatio);
  let first = -1;
  let last = -1;
  for (let i = 0; i < nFrames; i++) {
    if (rms[i] > thr) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { pcm, offsetSec: 0 }; // silence only

  const padFrames = Math.round(padSec * SAMPLE_RATE / hop);
  const startSample = Math.max(0, first * hop - padFrames * hop);
  const endSample = Math.min(pcm.length, (last * hop + frame) + padFrames * hop);
  const offsetSec = startSample / SAMPLE_RATE;
  return { pcm: pcm.subarray(startSample, endSample), offsetSec };
}

// ---- Hallucination filter ----------------------------------------------------
// Whisper invents subtitles during silence. Drop chunks that match known
// hallucination phrases AND are isolated in time (silence before and after).

const HALLUCINATION_RE = new RegExp(
  '^(\\s*(thank you|thanks|thankyou|thanks for watching|thank you for watching|you|bye|goodbye|' +
  'see you|see you next time|subscribe|like and subscribe|please subscribe|am[ée]n|' +
  'subs by|subtitle by|captions by|transcribed by|www\\.|http)[.!?,\\s]*)+$',
  'i'
);
const REPEATED_WORD_RE = /^(\S+)(\s+\1){2,}[.!?\s]*$/i;

export function filterHallucinations(chunks) {
  const n = chunks.length;
  return chunks.filter((c, i) => {
    const ts = c.timestamp;
    if (!ts || ts.length < 2) return true;
    const text = (c.text || '').trim();
    if (!text) return false;
    const suspicious = HALLUCINATION_RE.test(text) || REPEATED_WORD_RE.test(text);
    if (!suspicious) return true;
    // Only drop when isolated: >=1.2s silence on both sides (or file edge)
    const prevEnd = i > 0 && chunks[i - 1].timestamp ? chunks[i - 1].timestamp[1] : ts[0] - 10;
    const nextStart = i < n - 1 && chunks[i + 1].timestamp ? chunks[i + 1].timestamp[0] : ts[1] + 10;
    const isolated = ts[0] - prevEnd > 1.2 && nextStart - ts[1] > 1.2;
    return !isolated;
  });
}

// ---- Transcription -----------------------------------------------------------

async function transcribeBlock(transcriber, pcmBlock, opts) {
  const result = await transcriber(pcmBlock, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(opts.language && opts.language !== 'auto' && !opts.isEnglishOnly ? { language: opts.language } : {}),
  });
  return result;
}

export async function transcribePcm(pcm, opts = {}, onProgress) {
  const transcriber = await getTranscriber(opts.modelId, {
    dtype: opts.dtype || 'auto',
    device: opts.device || 'auto',
    onProgress: opts.onModelProgress,
  });
  const isEnglishOnly = /\.en($|_)/.test(opts.modelId);
  const blockSamples = BLOCK_SEC * SAMPLE_RATE;
  const totalBlocks = Math.max(1, Math.ceil(pcm.length / blockSamples));
  const allChunks = [];
  let textParts = [];

  for (let b = 0; b < totalBlocks; b++) {
    const start = b * blockSamples;
    const block = pcm.subarray(start, Math.min(pcm.length, start + blockSamples));
    const res = await transcribeBlock(transcriber, block, { ...opts, isEnglishOnly });
    const offset = start / SAMPLE_RATE;
    for (const c of res.chunks || []) {
      if (c.timestamp && c.timestamp.length >= 2 && c.timestamp[0] != null && c.timestamp[1] != null) {
        allChunks.push({ text: c.text, timestamp: [c.timestamp[0] + offset, c.timestamp[1] + offset], language: c.language });
      } else if ((c.text || '').trim()) {
        allChunks.push({ text: c.text, timestamp: [offset, offset + BLOCK_SEC], language: c.language });
      }
    }
    if (res.text) textParts.push(res.text.trim());
    onProgress?.({ stage: 'transcribing', block: b + 1, totalBlocks });
  }

  const filtered = filterHallucinations(allChunks);
  return { chunks: filtered, text: textParts.join(' ').trim() };
}

// Full pipeline: media file -> wav -> pcm -> (trim) -> whisper -> filtered chunks
export async function transcribeFile(inputPath, opts = {}, onProgress) {
  const workDir = path.join(opts.tmpDir, crypto.randomUUID().slice(0, 8));
  await mkdir(workDir, { recursive: true });
  try {
    const wavPath = path.join(workDir, 'audio.wav');
    onProgress?.({ stage: 'extracting-audio' });
    await execFileP(
      ffmpegPath,
      ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-c:a', 'pcm_s16le', wavPath],
      { maxBuffer: 16 * 1024 * 1024 }
    );

    onProgress?.({ stage: 'loading-model' });
    const wav = await readFile(wavPath);
    let pcm = parseWav(wav);

    let offsetSec = 0;
    if (opts.trimSilence !== false) {
      const trimmed = trimSilenceEdges(pcm);
      pcm = trimmed.pcm;
      offsetSec = trimmed.offsetSec;
    }

    const { chunks, text } = await transcribePcm(pcm, opts, (p) => {
      onProgress?.({ ...p, offsetSec });
    });

    // Shift timestamps back onto the original timeline
    if (offsetSec > 0) {
      for (const c of chunks) {
        if (c.timestamp) c.timestamp = [c.timestamp[0] + offsetSec, c.timestamp[1] + offsetSec];
      }
    }

    return { chunks, text };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Build all subtitle formats from transcription chunks
export function buildAllFormats(chunks, style = {}) {
  const cues = buildCues(chunks, style);
  return {
    cues,
    srt: cuesToSrt(cues),
    vtt: cuesToVtt(cues),
    ass: cuesToAss(cues, style.ass || {}),
  };
}

