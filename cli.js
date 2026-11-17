#!/usr/bin/env node
// ScribeFlow CLI
// Usage: node cli.js <input media file> [-o out.srt] [options]
//   --model <key>        tiny|base|small|large-v3-turbo|*.en   (default: base)
//   --lang <code>        auto|en|es|...                        (default: auto)
//   --dtype <d>          auto|q8|fp32                           (default: auto)
//   --max-chars <n>      chars per line                         (default: 42)
//   --max-words <n>      words per line, 0=off                  (default: 0)
//   --max-lines <n>      lines per cue                          (default: 2)
//   --pause <sec>        split cues on pauses longer than       (default: 0.7)
//   --no-trim            disable silence edge-trimming
//   --format <f>         srt|vtt|ass                             (default: srt)
//   --device <d>         auto|cpu|dml (DirectML GPU)              (default: auto)
//   --translate <lang>   translate subtitles to language code    (e.g. es, fr, de)
//   --out-dir <dir>      output directory                       (default: .)

import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  MODELS, setupEnv, transcribeFile, buildAllFormats,
  translateCues, isTranslationSupported,
} from './transcribe.js';
import { cuesToSrt } from './srt.js';
import { cuesToVtt, cuesToAss, buildChapters, chaptersToText } from './subs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
setupEnv(path.join(__dirname, 'model-cache'));

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'no-trim') { opts.trimSilence = false; continue; }
      opts[key] = argv[++i];
    } else {
      opts._.push(a);
    }
  }
  return opts;
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('Usage: node cli.js <input file> [options] — see header of cli.js');
  process.exit(1);
}

const modelKey = args.model || 'base';
const modelId = MODELS[modelKey];
if (!modelId) {
  console.error(`Unknown model "${modelKey}". Available: ${Object.keys(MODELS).join(', ')}`);
  process.exit(1);
}

const style = {
  maxCharsPerLine: parseInt(args['max-chars'], 10) || 42,
  maxWordsPerLine: parseInt(args['max-words'], 10) || 0,
  maxLines: parseInt(args['max-lines'], 10) || 2,
  pauseSec: parseFloat(args.pause) || 0.7,
};
const format = (args.format || 'srt').toLowerCase();

const base = path.basename(input).replace(/\.[^.]+$/, '');
const outDir = args['out-dir'] || '.';
await mkdir(outDir, { recursive: true });

const t0 = Date.now();
console.log(`Transcribing ${input}`);
console.log(`  model=${modelKey} lang=${args.lang || 'auto'} format=${format}`);

const { chunks, text } = await transcribeFile(path.resolve(input), {
  modelId,
  language: args.lang || 'auto',
  dtype: args.dtype || 'auto',
  tmpDir: path.join(__dirname, 'tmp'),
  trimSilence: args.trimSilence !== false,
  device: args.device || 'auto',
}, (p) => {
  if (p.stage === 'extracting-audio') process.stdout.write('extracting audio… ');
  else if (p.stage === 'loading-model') process.stdout.write('loading model… ');
  else if (p.stage === 'transcribing') {
    process.stdout.write(`\rtranscribing block ${p.block}/${p.totalBlocks}…   `);
  } else if (p.stage === 'building-srt') process.stdout.write('\nbuilding subtitles… ');
});

const formats = buildAllFormats(chunks, style);
const content = formats[format] === undefined ? formats.srt : formats[format];
const ext = format === 'ass' ? '.ass' : format === 'vtt' ? '.vtt' : '.srt';
const finalPath = (args.o || args.out) ? path.resolve(args.o || args.out) : path.join(outDir, base + ext);
await writeFile(finalPath, content);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${secs}s — ${formats.cues.length} cues, ${chunks.length} segments`);
console.log(`Wrote ${finalPath}`);
if (text) console.log(`\nText preview: ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);

// Chapters file
const chapters = buildChapters(formats.cues);
if (chapters.length > 1) {
  const chPath = path.join(outDir, base + '.chapters.txt');
  await writeFile(chPath, chaptersToText(chapters));
  console.log(`Wrote ${chPath} (${chapters.length} chapters)`);
}

// Optional translation
const translateTo = args.translate || 'none';
const srcLang = args.lang || 'en';
if (isTranslationSupported(srcLang, translateTo)) {
  console.log(`Translating to ${translateTo}…`);
  const tcues = await translateCues(formats.cues, srcLang, translateTo, (p) => {
    process.stdout.write(`\r  cue ${p.cue}/${p.totalCues}   `);
  });
  process.stdout.write('\n');
  const tContent = format === 'ass' ? cuesToAss(tcues, style.ass) : format === 'vtt' ? cuesToVtt(tcues) : cuesToSrt(tcues);
  const tExt = format === 'ass' ? '.ass' : format === 'vtt' ? '.vtt' : '.srt';
  const tPath = path.join(outDir, `${base}.${translateTo}${tExt}`);
  await writeFile(tPath, tContent);
  console.log(`Wrote ${tPath}`);
} else if (translateTo !== 'none') {
  console.log(`Translation to "${translateTo}" not supported for this language pair`);
}
