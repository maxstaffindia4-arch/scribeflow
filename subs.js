// Subtitle format converters. All work from cue arrays produced by buildCues().
import { fmtTime } from './srt.js';

// Chapter markers from cue timings: new chapter on long pauses or max length.
export function buildChapters(cues, { gapSec = 4, maxSec = 600 } = {}) {
  if (!cues?.length) return [];
  const chapters = [];
  let start = cues[0].start;
  let prevEnd = cues[0].end;
  let n = 1;
  const push = (end) => chapters.push({ n: chapters.length + 1, start, end });

  for (let i = 1; i < cues.length; i++) {
    const gap = cues[i].start - prevEnd;
    const dur = cues[i].end - start;
    if (gap > gapSec || dur > maxSec) {
      push(prevEnd);
      start = cues[i].start;
      n++;
    }
    prevEnd = cues[i].end;
  }
  push(prevEnd);
  return chapters;
}

// YouTube-description style chapter list: "0:00 Chapter 1"
export function chaptersToText(chapters) {
  return chapters
    .map((c) => {
      const t = c.start;
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = Math.floor(t % 60);
      const stamp = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
      return `${stamp} Chapter ${c.n}`;
    })
    .join('\n') + '\n';
}

// WebVTT
export function cuesToVtt(cues) {
  const body = cues
    .map((c) => `${fmtTime(c.start, '.')} --> ${fmtTime(c.end, '.')}\n${c.lines.join('\n')}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

const ASS_COLORS = {
  white: '&H00FFFFFF',
  yellow: '&H0000FFFF',
  cyan: '&H00FFFF',
  green: '&H0000FF00',
};

// Minimal SSA/ASS with one styled event per cue.
export function cuesToAss(cues, style = {}) {
  const {
    fontName = 'Arial',
    fontSize = 16,
    primaryColor = 'white',
    outlineColor = '&H00000000',
    backColor = '&H80000000',
    bold = 0,
    alignment = 2, // bottom-center
  } = style;

  const playResX = 384;
  const playResY = 216;
  const color = ASS_COLORS[primaryColor] || primaryColor;

  const assTime = (sec) => {
    sec = Math.max(0, sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.round((sec - Math.floor(sec)) * 100);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${h}:${p(m)}:${p(s)}.${p(cs)}`;
  };

  const header = `[Script Info]
Title: Generated subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${color},&H000000FF,${outlineColor},${backColor},${bold},0,0,0,100,100,0,0,1,2,1,${alignment},10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues
    .map((c) => {
      const text = c.lines.join('\\N');
      return `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${text}`;
    })
    .join('\n');

  return header + events + '\n';
}
