// Turns Whisper word-level timestamp chunks into subtitle cues.

const DEFAULTS = {
  maxCharsPerLine: 42,
  maxWordsPerLine: 0, // 0 = unlimited
  maxLines: 2,
  maxCueSec: 6,
  pauseSec: 0.7, // split cues on speech gaps longer than this
  minCueSec: 1.0,
};

export function fmtTime(sec, sep = ',') {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms, 3)}`;
}

// Greedy word wrap honoring max chars/line, optional max words/line, max lines.
// Returns null if the text cannot fit.
export function wrapText(text, o) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let lineWords = 0;

  const lineFull = (w) =>
    (line ? line.length + 1 + w.length : w.length) > o.maxCharsPerLine ||
    (o.maxWordsPerLine > 0 && lineWords + 1 > o.maxWordsPerLine);

  for (const w of words) {
    if (line && lineFull(w)) {
      lines.push(line);
      if (lines.length === o.maxLines) return null;
      line = '';
      lineWords = 0;
    }
    if (!line && w.length > o.maxCharsPerLine) {
      // hard-split an overlong word
      let rest = w;
      while (rest.length > o.maxCharsPerLine) {
        lines.push(rest.slice(0, o.maxCharsPerLine));
        if (lines.length === o.maxLines) return null;
        rest = rest.slice(o.maxCharsPerLine);
      }
      line = rest;
      lineWords = 1;
      continue;
    }
    line = line ? `${line} ${w}` : w;
    lineWords++;
  }
  if (line) lines.push(line);
  if (lines.length > o.maxLines) return null;
  return lines.join('\n');
}

function fits(text, o) {
  return wrapText(text, o) !== null;
}

export function normalizeOptions(options = {}) {
  const o = { ...DEFAULTS, ...options };
  o.maxCharsPerLine = Math.max(10, Math.min(120, o.maxCharsPerLine | 0));
  o.maxWordsPerLine = Math.max(0, Math.min(30, o.maxWordsPerLine | 0));
  o.maxLines = Math.max(1, Math.min(4, o.maxLines | 0));
  o.pauseSec = Math.max(0.1, Math.min(5, o.pauseSec ?? DEFAULTS.pauseSec));
  o.maxCueSec = Math.max(2, Math.min(15, o.maxCueSec));
  o.minCueSec = Math.max(0.3, Math.min(3, o.minCueSec));
  return o;
}

// chunks: [{ text, timestamp: [start, end] }] in seconds.
// Returns [{ start, end, text, lines: string[] }]
export function buildCues(chunks, options = {}) {
  const o = normalizeOptions(options);

  const words = [];
  for (const c of chunks || []) {
    const ts = c.timestamp;
    if (!ts || ts.length < 2 || ts[0] == null || ts[1] == null) continue;
    const text = (c.text || '').trim();
    if (!text) continue;
    for (const p of text.split(/\s+/).filter(Boolean)) {
      words.push({ text: p, start: ts[0], end: ts[1] });
    }
  }
  if (!words.length) return [];

  const cues = [];
  let curWords = [];
  let curText = '';
  let curStart = words[0].start;
  let curEnd = words[0].end;

  const flush = () => {
    if (!curWords.length) return;
    const end = Math.max(curEnd, curStart + o.minCueSec);
    cues.push({ start: curStart, end, text: curText });
    curWords = [];
    curText = '';
    curStart = null;
    curEnd = null;
  };

  for (const w of words) {
    if (curWords.length) {
      const gap = w.start - curEnd;
      const dur = w.end - curStart;
      const candidate = curText ? `${curText} ${w.text}` : w.text;
      const prev = curWords[curWords.length - 1].text;
      const sentenceEnd = /[.!?…]["'”’)\]]*$/.test(prev);
      if (gap > o.pauseSec || dur > o.maxCueSec || !fits(candidate, o) ||
          (sentenceEnd && curWords.length >= 2)) {
        flush();
      }
    }
    if (!curWords.length) {
      curStart = w.start;
      curText = w.text;
    } else {
      curText += ` ${w.text}`;
    }
    curWords.push(w);
    curEnd = w.end;
  }
  flush();

  // Ensure monotonic, non-overlapping cues.
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].end > cues[i + 1].start) {
      cues[i].end = Math.max(cues[i].start + 0.2, cues[i + 1].start - 0.02);
    }
  }

  return cues.map((c) => ({
    start: c.start,
    end: c.end,
    text: c.text,
    lines: (wrapText(c.text, o) || c.text).split('\n'),
  }));
}

export function cuesToSrt(cues) {
  return cues
    .map((c, i) => `${i + 1}\n${fmtTime(c.start)} --> ${fmtTime(c.end)}\n${c.lines.join('\n')}\n`)
    .join('\n');
}

// chunks: [{ text, timestamp: [start, end] }] in seconds.
export function chunksToSrt(chunks, options = {}) {
  return cuesToSrt(buildCues(chunks, options));
}
