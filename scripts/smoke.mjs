// Smoke test: runs the full transcription pipeline on a tiny generated WAV.
// Usage: node scripts/smoke.mjs   (from project root)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { MODELS, setupEnv, transcribeFile, buildAllFormats } from '../transcribe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
setupEnv(path.join(root, 'model-cache'));

const dir = mkdtempSync(path.join(tmpdir(), 'scribeflow-smoke-'));
const wav = path.join(dir, 'tone.wav');
execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-ar', '16000', '-ac', '1', wav], { stdio: 'pipe' });

console.log('smoke: transcribing 3s tone with', MODELS['tiny.en']);
const t0 = Date.now();
const { chunks } = await transcribeFile(wav, {
  modelId: MODELS['tiny.en'],
  language: 'en',
  device: 'cpu',
  tmpDir: dir,
}, (p) => process.stdout.write(`\r  ${p.stage}${p.block ? ` ${p.block}/${p.totalBlocks}` : ''}   `));
process.stdout.write('\n');

const formats = buildAllFormats(chunks, {});
console.log(`smoke: ok in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${chunks.length} chunks, ${formats.cues.length} cues`);
if (typeof formats.srt !== 'string' || typeof formats.vtt !== 'string' || typeof formats.ass !== 'string') {
  throw new Error('missing output formats');
}
console.log('smoke: PASS');
