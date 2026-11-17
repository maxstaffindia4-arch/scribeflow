import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, Download, Copy, RefreshCw, Flame, FileText,
  AlertTriangle, Volume2,
} from 'lucide-react';
import { Badge, Button } from './ui';
import type { TranscribeResult } from '@/types';
import { downloadText, downloadBlob, copyText, fmtTime, parseSrt } from '@/utils';

interface ResultCardProps {
  filename: string;
  cues: number;
  language: string;
  chapters: number;
  isVideo: boolean;
  isAudio?: boolean;
  translatedLang?: string;
  objectUrl?: string;
  file?: File;
  result: TranscribeResult;
}

export function ResultCard({
  filename,
  cues,
  language,
  chapters,
  isVideo,
  isAudio,
  translatedLang,
  objectUrl,
  file,
  result,
}: ResultCardProps) {
  const [search, setSearch] = useState('');
  const [editedSrt, setEditedSrt] = useState(result.srt);
  const [editedTranslated, setEditedTranslated] = useState(result.translated?.srt ?? '');
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isMedia = isVideo || isAudio;

  // parse cues once for the cue list
  const cueList = useMemo(() => parseSrt(result.srt), [result.srt]);
  const filtered = useMemo(
    () => cueList.filter((c) => c.text.toLowerCase().includes(search.toLowerCase())),
    [cueList, search]
  );

  const activeIdx = cueList.findIndex((c) => currentTime >= c.start && currentTime < c.end);

  // keep active cue visible
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  const seek = (start: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = start;
      mediaRef.current.play().catch(() => {});
    }
  };

  const reparse = () => {
    const parsed = parseSrt(editedSrt);
    const warns: string[] = [];
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].start < parsed[i - 1].end) warns.push(`Cue ${parsed[i].index} overlaps cue ${parsed[i - 1].index}`);
    }
    setWarnings(warns);
  };

  // SRT download uses edited text
  const base = filename.replace(/\.[^.]+$/, '');
  const downloadSrt = () => downloadText(editedSrt, `${base}.srt`, 'text/plain');
  const downloadVtt = () => {
    const cues = parseSrt(editedSrt);
    const vtt = 'WEBVTT\n\n' + cues.map((c) => `${fmtVtt(c.start)} --> ${fmtVtt(c.end)}\n${c.text}`).join('\n\n') + '\n';
    downloadText(vtt, `${base}.vtt`, 'text/vtt');
  };
  const downloadAss = () => downloadText(result.ass, `${base}.ass`, 'text/plain');
  const downloadChapters = () => result.chaptersText && downloadText(result.chaptersText, `${base}-chapters.txt`, 'text/plain');
  const burnVideo = async () => {
    if (!file) return;
    try {
      // 1) store the (possibly edited) SRT server-side
      const storeRes = await fetch('/api/store-sub', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: editedSrt,
      });
      if (!storeRes.ok) throw new Error('Could not store subtitle');
      const { id } = await storeRes.json();

      // 2) upload the video raw with ?sub=<id>
      const burnRes = await fetch(`/api/burn?sub=${encodeURIComponent(id)}&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!burnRes.ok) {
        const j = await burnRes.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${burnRes.status}`);
      }
      const blob = await burnRes.blob();
      downloadBlob(blob, `${base}-subbed.mp4`, 'video/mp4');
    } catch (e) {
      alert('Burn-in failed: ' + (e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-200 bg-white shadow-lift overflow-hidden animate-fadeIn">
      {/* Card header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-ink-50/80 to-white">
        <div className="flex items-center gap-2.5 min-w-0">
          {isVideo ? <FileText size={18} className="text-accent-500 shrink-0" /> : <Volume2 size={18} className="text-brand-500 shrink-0" />}
          <h3 className="text-sm font-medium text-ink-900 truncate">{filename}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge tone="brand">{cues} cues</Badge>
          <Badge tone="muted">{language}</Badge>
          {chapters > 0 && <Badge tone="accent">{chapters} chapters</Badge>}
        </div>
      </div>

      {/* Two-column body: media preview + cue list */}
      <div className="grid md:grid-cols-2 gap-px bg-ink-100">
        {/* Media preview */}
        <div className="bg-white p-5">
          {isMedia && objectUrl ? (
            isVideo ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={objectUrl}
                controls
                className="w-full rounded-xl bg-ink-900 shadow-inner"
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            ) : (
              <div className="rounded-xl bg-ink-900 p-6 flex flex-col items-center gap-4 shadow-inner">
                <audio
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  src={objectUrl}
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <Volume2 size={40} className="text-brand-400" />
                <p className="text-xs text-white/60 tabular-nums">{fmtTime(currentTime)}</p>
                <div className="flex items-center gap-2 w-full">
                  <Button size="sm" variant="secondary" icon={playing ? undefined : undefined} onClick={() => mediaRef.current?.play()}>
                    Play
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => mediaRef.current?.pause()}>
                    Pause
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-xl bg-ink-900 aspect-video flex items-center justify-center shadow-inner">
              <p className="text-xs text-white/50">No preview available</p>
            </div>
          )}
        </div>

        {/* Cue list */}
        <div className="bg-white p-5 flex flex-col gap-3 min-h-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subtitles…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-ink-50 border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 focus:bg-white outline-none text-sm text-ink-800 placeholder:text-ink-400 transition-all"
            />
          </div>
          <div className="rounded-xl border border-ink-200 bg-ink-50/50 overflow-auto max-h-[280px]">
            <ul ref={listRef} className="divide-y divide-ink-100">
              {filtered.map((cue) => {
                // parseSrt assigns sequential 1-based indices, so index-1 is the position in cueList
                const active = cue.index - 1 === activeIdx;
                return (
                  <li
                    key={cue.index}
                    onClick={() => seek(cue.start)}
                    className={`px-3 py-2 flex gap-3 cursor-pointer transition-all ${
                      active ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-white'
                    }`}
                  >
                    <span className={`text-[11px] tabular-nums shrink-0 w-12 pt-0.5 ${active ? 'text-brand-600' : 'text-ink-400'}`}>
                      {fmtTime(cue.start)}
                    </span>
                    <span className={`text-sm ${active ? 'text-brand-800 font-medium' : 'text-ink-700'}`}>{cue.text}</span>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-400">No matches</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* SRT editor */}
      <div className="px-5 py-4 border-t border-ink-100">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-medium text-ink-700">SRT (editable)</span>
          <Badge tone="warn">
            <AlertTriangle size={10} /> edits not saved to cue list
          </Badge>
          {warnings.length > 0 && (
            <Badge tone="err">{warnings.length} timing issue{warnings.length > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <textarea
          value={editedSrt}
          onChange={(e) => setEditedSrt(e.target.value)}
          spellCheck={false}
          className="w-full h-48 rounded-xl bg-ink-950 border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 outline-none p-3 text-[13px] leading-relaxed font-mono text-ink-100 resize-y transition-all"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button size="sm" icon={<Download size={13} />} onClick={downloadSrt}>SRT</Button>
          <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={downloadVtt}>VTT</Button>
          <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={downloadAss}>ASS</Button>
          {result.chaptersText && (
            <Button size="sm" variant="secondary" icon={<FileText size={13} />} onClick={downloadChapters}>Chapters.txt</Button>
          )}
          <Button size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => copyText(editedSrt)}>Copy SRT</Button>
          <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={reparse}>Re-parse cues</Button>
          {isVideo && (
            <Button size="sm" variant="secondary" icon={<Flame size={13} />} className="ml-auto" onClick={burnVideo}>
              Burn into video…
            </Button>
          )}
        </div>
      </div>

      {/* Translated section */}
      {translatedLang && result.translated && (
        <div className="px-5 py-4 border-t border-ink-100 bg-gradient-to-r from-brand-50/50 to-accent-50/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-ink-700">
              Translated subtitles ({translatedLang})
            </span>
          </div>
          <textarea
            value={editedTranslated}
            onChange={(e) => setEditedTranslated(e.target.value)}
            spellCheck={false}
            className="w-full h-40 rounded-xl bg-ink-950 border border-ink-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 outline-none p-3 text-[13px] leading-relaxed font-mono text-ink-100 resize-y transition-all"
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button size="sm" icon={<Download size={13} />} onClick={() => downloadText(editedTranslated, `${base}-${translatedLang!.toLowerCase()}.srt`, 'text/plain')}>Translated SRT</Button>
            <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => {
              const cues = parseSrt(editedTranslated);
              const vtt = 'WEBVTT\n\n' + cues.map((c) => `${fmtVtt(c.start)} --> ${fmtVtt(c.end)}\n${c.text}`).join('\n\n') + '\n';
              downloadText(vtt, `${base}-${translatedLang!.toLowerCase()}.vtt`, 'text/vtt');
            }}>VTT</Button>
            <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => downloadText(result.translated!.ass, `${base}-${translatedLang!.toLowerCase()}.ass`, 'text/plain')}>ASS</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtVtt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
