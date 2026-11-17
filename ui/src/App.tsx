import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Trash2, HardDriveDownload, Info } from 'lucide-react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { SettingsGrid, AssStyling, WatchFolder, type Settings, type AssStyle } from '@/components/Settings';
import { ProgressArea } from '@/components/ProgressArea';
import { ResultCard } from '@/components/ResultCard';
import { EmptyState } from '@/components/EmptyState';
import { TourOverlay } from '@/components/TourOverlay';
import { Button } from '@/components/ui';
import type { QueueFile, TranscribeResult } from '@/types';
import {
  uid, LANG_TO_CODE, TRANSLATE_TO_CODE, DEVICE_TO_API,
  POSITION_TO_ALIGN, COLOR_TO_ASS,
} from '@/types';

interface StatusInfo {
  busy: boolean;
  stage: string;
  file?: string | null;
  block?: number | null;
  totalBlocks?: number | null;
  cue?: number;
  totalCues?: number;
  progress?: { status?: string; file?: string; progress?: number; loaded?: number; total?: number } | null;
}

function App() {
  const [files, setFiles] = useState<QueueFile[]>([]);
  const [settings, setSettings] = useState<Settings>({
    model: 'base',
    language: 'Auto-detect',
    translate: 'None',
    device: 'auto',
    precision: 'auto',
    maxChars: 42,
    maxWords: 0,
    linesPerCue: 2,
    splitPause: 0.7,
  });
  const [assStyle, setAssStyle] = useState<AssStyle>({
    font: 'Arial',
    size: 48,
    color: 'White',
    position: 'Bottom',
    bold: false,
  });
  const [watchPath, setWatchPath] = useState('');
  const [watching, setWatching] = useState(false);
  const [watchFiles, setWatchFiles] = useState<{ name: string; path: string; mtimeMs: number }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [hasResults, setHasResults] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('scribeflow.recents') || '[]'); } catch { return []; }
  });
  const pollRef = useRef<number | null>(null);

  const hasQueued = files.some((f) => f.status === 'queued' || f.status === 'processing');
  const queuedCount = files.filter((f) => f.status === 'queued').length;
  const statusText = processing
    ? statusTextFromStatus(status)
    : hasQueued
      ? `${queuedCount} queued`
      : files.length > 0
        ? 'Ready — click Generate'
        : 'Pick files to begin';

  // persist settings
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('scribeflow.settings') || '{}');
      if (s.settings) setSettings(s.settings);
      if (s.ass) setAssStyle(s.ass);
      if (s.watchPath) setWatchPath(s.watchPath);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem('scribeflow.settings', JSON.stringify({ settings, ass: assStyle, watchPath }));
  }, [settings, assStyle, watchPath]);

  // auto-open tour on first run
  useEffect(() => {
    if (localStorage.getItem('scribeflow.tipSeen') !== '1') {
      const t = window.setTimeout(() => setTourOpen(true), 500);
      return () => window.clearTimeout(t);
    }
  }, []);
  // status polling while processing
  useEffect(() => {
    if (!processing) {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const tick = async () => {
      try {
        const j = await (await fetch('/api/status')).json();
        setStatus(j);
      } catch {}
    };
    tick();
    pollRef.current = window.setInterval(tick, 800);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [processing]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    localStorage.setItem('scribeflow.tipSeen', '1');
  }, []);

  const addFiles = useCallback((incoming: { name: string; size: number; file: File }[]) => {
    setFiles((prev) => [
      ...prev,
      ...incoming.map((f) => ({
        id: uid(), name: f.name, size: f.size, status: 'queued' as const,
        file: f.file, objectUrl: URL.createObjectURL(f.file),
      })),
    ]);
    setHasResults(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => {
      if (f.id === id && f.objectUrl) URL.revokeObjectURL(f.objectUrl);
      return f.id !== id;
    }));
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => { prev.forEach(f => f.objectUrl && URL.revokeObjectURL(f.objectUrl)); return []; });
    setHasResults(false);
  }, []);

  const clearCache = useCallback(async () => {
    if (!confirm('Delete all downloaded models? They will re-download on next use.')) return;
    await fetch('/api/cache/clear', { method: 'POST', body: JSON.stringify({ scope: 'models' }) });
  }, []);

  // ---- watch folder ----
  const toggleWatch = useCallback(async () => {
    if (watching) {
      await fetch('/api/watch', { method: 'POST', body: JSON.stringify({ action: 'stop' }) });
      setWatching(false);
      setWatchFiles([]);
      return;
    }
    const dir = watchPath.trim();
    if (!dir) return;
    const res = await fetch('/api/watch', { method: 'POST', body: JSON.stringify({ action: 'start', path: dir }) });
    const j = await res.json();
    if (!res.ok) { alert(j.error || 'Could not watch folder'); return; }
    setWatching(true);
    pollWatchFiles();
    watchPollRef.current = window.setInterval(pollWatchFiles, 3000);
  }, [watching, watchPath]);

  const watchPollRef = useRef<number | null>(null);
  const pollWatchFiles = useCallback(async () => {
    try {
      const j = await (await fetch('/api/watch')).json();
      if (!j.watching) {
        setWatching(false);
        if (watchPollRef.current) { window.clearInterval(watchPollRef.current); watchPollRef.current = null; }
        return;
      }
      setWatchFiles(j.files || []);
    } catch {}
  }, []);

  const importWatchFile = useCallback(async (path: string, mtimeMs: number) => {
    const key = `${path}|${mtimeMs}`;
    if (importedWatch.current.has(key)) return;
    importedWatch.current.add(key);
    try {
      const res = await fetch('/api/local-file?path=' + encodeURIComponent(path));
      if (!res.ok) return;
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/)?.[1] || path.split(/[\\/]/).pop() || 'file');
      addFiles([{ name, size: blob.size, file: new File([blob], name) }]);
    } catch {}
  }, [addFiles]);
  const importedWatch = useRef<Set<string>>(new Set());

  // ---- generation ----
  const generate = useCallback(async () => {
    const queued = files.filter((f) => f.status === 'queued' && f.file);
    if (!queued.length) return;
    setProcessing(true);
    setHasResults(false);

    for (const item of queued) {
      setFiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'processing' } : p)));
      try {
        const params = new URLSearchParams({
          filename: item.file!.name,
          model: settings.model,
          language: LANG_TO_CODE[settings.language] || 'auto',
          translateTo: TRANSLATE_TO_CODE[settings.translate] || 'none',
          device: DEVICE_TO_API[settings.device] || 'auto',
          dtype: settings.precision === 'auto' ? 'auto' : settings.precision,
          maxChars: String(settings.maxChars),
          maxWords: String(settings.maxWords),
          maxLines: String(settings.linesPerCue),
          pauseSec: String(settings.splitPause),
          assFont: assStyle.font,
          assSize: String(assStyle.size),
          assColor: COLOR_TO_ASS[assStyle.color] || 'white',
          assPos: String(POSITION_TO_ALIGN[assStyle.position] || 2),
          assBold: assStyle.bold ? '1' : '0',
        });
        const res = await fetch('/api/transcribe?' + params, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: item.file!,
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        const result: TranscribeResult = {
          srt: j.srt, vtt: j.vtt, ass: j.ass, cues: j.cues || [],
          cueCount: j.cueCount || 0, chaptersText: j.chaptersText,
          chapters: j.chapters, detectedLanguage: j.detectedLanguage,
          translated: j.translated || null,
        };
        setFiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'done', cues: result.cueCount, result } : p)));
        setRecentFiles((prev) => {
          const next = [item.file!.name, ...prev.filter((n) => n !== item.file!.name)].slice(0, 5);
          localStorage.setItem('scribeflow.recents', JSON.stringify(next));
          return next;
        });
      } catch (e) {
        setFiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'error', error: (e as Error).message } : p)));
      }
    }
    setProcessing(false);
    setStatus(null);
    setHasResults(true);
  }, [files, settings, assStyle]);

  const isVideoName = (n: string) => /\.(mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i.test(n);
  const isAudioName = (n: string) => /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma)$/i.test(n);

  return (
    <div className="relative min-h-screen text-ink-800">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#d6d4df]" />
      <div className="fixed inset-0 -z-10 bg-mesh opacity-80" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(40,22,95,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(40,22,95,0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <Header onHelp={() => { setTourStep(0); setTourOpen(true); }} />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Input card */}
        <section className="relative rounded-2xl border border-ink-200 glass shadow-card p-5 sm:p-6 flex flex-col gap-6">
          <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-brand-300/50 to-transparent" />

          <DropZone files={files} onAddFiles={addFiles} onRemove={removeFile} emphasized={files.length === 0 && !processing} recentFiles={recentFiles} />

          <div className="border-t border-ink-200/70 pt-5">
            <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-4">Transcription settings</h2>
            <SettingsGrid settings={settings} onChange={setSettings} />
            <div className="mt-4">
              <AssStyling style={assStyle} onChange={setAssStyle} />
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3" data-tour="generate">
            <Button onClick={generate} disabled={!hasQueued || processing} icon={<Sparkles size={16} />} size="md" className="px-5">
              Generate Subtitles
            </Button>
            <Button variant="ghost" size="md" icon={<Trash2 size={15} />} onClick={clearAll} disabled={files.length === 0}>
              Clear
            </Button>
            <Button variant="ghost" size="md" icon={<HardDriveDownload size={15} />} onClick={clearCache} data-tour="clearcache">
              Clear model cache
            </Button>
            <span className="text-xs text-ink-500 ml-auto">{statusText}</span>
          </div>

          <ProgressArea active={processing} stage={statusText} percent={progressPercent(status)} />

          <WatchFolder
            path={watchPath}
            onPathChange={setWatchPath}
            watching={watching}
            onToggle={toggleWatch}
            files={watchFiles}
            onQueueFile={(f) => importWatchFile(f.path, f.mtimeMs)}
          />

          {/* Hint text */}
          <div className="rounded-xl bg-ink-50/80 border border-ink-200 p-4 flex gap-3">
            <Info size={15} className="text-brand-500 shrink-0 mt-0.5" />
            <div className="text-[12px] text-ink-600 leading-relaxed space-y-1.5">
              <p><strong className="text-ink-900">Layout rules:</strong> max chars &amp; max words cap each line; lines per cue stacks wrapped lines; split-on-pause starts a new cue after silence.</p>
              <p><strong className="text-ink-900">Translation:</strong> local opus-mt models via English pivot — first use downloads ~80–300 MB per pair.</p>
              <p><strong className="text-ink-900">Device:</strong> Auto uses DirectML GPU when available; CPU is the fallback. Q8 = faster, FP32 = best quality.</p>
              <p><strong className="text-ink-900">Model cache:</strong> downloaded models are reused across sessions. Clear it to reclaim disk space.</p>
            </div>
          </div>
        </section>

        {/* Results area */}
        <section className="flex flex-col gap-4">
          {hasResults && files.some((f) => f.status === 'done' && f.result) ? (
            files
              .filter((f) => f.status === 'done' && f.result)
              .map((f) => (
                <ResultCard
                  key={f.id}
                  filename={f.name}
                  cues={f.result!.cueCount}
                  language={f.result!.detectedLanguage || settings.language}
                  chapters={f.result!.chapters?.length ?? 0}
                  isVideo={isVideoName(f.name)}
                  isAudio={isAudioName(f.name)}
                  translatedLang={settings.translate !== 'None' ? settings.translate.slice(0, 2).toUpperCase() : undefined}
                  objectUrl={f.objectUrl}
                  file={f.file}
                  result={f.result!}
                />
              ))
          ) : (
            <EmptyState />
          )}
        </section>
      </main>

      <TourOverlay
        open={tourOpen}
        step={tourStep}
        onClose={closeTour}
        onStep={setTourStep}
      />
    </div>
  );
}

function statusTextFromStatus(s: StatusInfo | null): string {
  if (!s) return 'Processing…';
  switch (s.stage) {
    case 'receiving': return 'Receiving file…';
    case 'extracting-audio': return 'Extracting audio…';
    case 'loading-model': {
      if (s.progress?.status === 'progress' && s.progress.file) {
        const pct = s.progress.progress != null ? ` — ${Math.round(s.progress.progress * 100)}%` : '';
        return `Downloading model: ${s.progress.file}${pct}`;
      }
      return 'Loading model (first run downloads it)…';
    }
    case 'transcribing':
      return s.totalBlocks ? `Transcribing block ${s.block}/${s.totalBlocks}…` : 'Transcribing…';
    case 'building-srt': return 'Building subtitles…';
    case 'translating':
      return s.totalCues ? `Translating cue ${s.cue}/${s.totalCues}…` : 'Translating…';
    case 'burning': return 'Burning subtitles…';
    default: return s.stage || 'Processing…';
  }
}

function progressPercent(s: StatusInfo | null): number {
  if (!s) return 5;
  if (s.stage === 'transcribing' && s.totalBlocks) return Math.round(((s.block ?? 0) / s.totalBlocks) * 90) + 5;
  if (s.stage === 'translating' && s.totalCues) return Math.round(((s.cue ?? 0) / s.totalCues) * 90) + 5;
  if (s.stage === 'building-srt') return 92;
  if (s.stage === 'burning') return 95;
  return 15;
}

export default App;
