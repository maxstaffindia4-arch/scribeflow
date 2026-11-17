export interface ParsedCue {
  index: number;
  start: number; // seconds
  end: number;
  text: string;
}

export function parseSrt(srt: string): ParsedCue[] {
  const cues: ParsedCue[] = [];
  const blocks = srt.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeMatch = lines[1].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!timeMatch) continue;
    const toSec = (h: string, m: string, s: string, ms: string) =>
      +h * 3600 + +m * 60 + +s + +ms / 1000;
    cues.push({
      index: cues.length + 1,
      start: toSec(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]),
      end: toSec(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]),
      text: lines.slice(2).join(' '),
    });
  }
  return cues;
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function downloadText(content: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, filename, mime);
}

export function downloadBlob(blob: Blob, filename: string, _mime?: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
