import { useRef, useState } from 'react';
import { UploadCloud, Plus, CheckCircle2, AlertCircle, Loader2, Clock, X } from 'lucide-react';
import type { QueueFile } from '@/types';
import { formatBytes, SUPPORTED_FORMATS } from '@/types';
import { Badge } from './ui';

interface DropZoneProps {
  files: QueueFile[];
  onAddFiles: (files: { name: string; size: number; file: File }[]) => void;
  onRemove: (id: string) => void;
  emphasized?: boolean;
  recentFiles?: string[];
}

export function DropZone({ files, onAddFiles, onRemove, emphasized, recentFiles = [] }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toItems = (list: FileList | File[]) =>
    [...list].map((f) => ({ name: f.name, size: f.size, file: f }));

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    onAddFiles(toItems(e.dataTransfer.files));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        data-tour="dropzone"
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden ${
          dragging
            ? 'border-brand-400 bg-brand-50/60 scale-[1.01] shadow-glow'
            : emphasized
              ? 'border-brand-300 bg-gradient-to-br from-brand-50/50 via-white to-accent-50/30 animate-pulseRing'
              : 'border-ink-300 bg-white/60 hover:border-brand-300 hover:bg-brand-50/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="audio/*,video/*,.wav,.mp3,.m4a,.flac,.ogg,.opus,.mp4,.mkv,.mov,.webm,.avi,.m4v"
          onChange={(e) => { if (e.target.files?.length) onAddFiles(toItems(e.target.files)); e.target.value = ''; }}
        />
        {emphasized && (
          <div className="absolute inset-0 bg-mesh opacity-70 pointer-events-none" />
        )}
        <div className="relative px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-3">
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl transition-all ${
              dragging
                ? 'bg-brand-500 text-white scale-110 shadow-glow'
                : emphasized
                  ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] animate-float'
                  : 'bg-white text-brand-600 border border-ink-200 shadow-soft'
            }`}
          >
            <UploadCloud size={26} strokeWidth={2} />
          </div>
          <div>
            <p className={`text-base font-medium ${dragging ? 'text-brand-700' : 'text-ink-900'}`}>
              {dragging ? 'Release to add' : 'Drop audio or video here'}
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {SUPPORTED_FORMATS.join(', ')} — multiple files OK — or click to browse
            </p>
          </div>
        </div>
      </div>

      {/* Queue list */}
      <div className="rounded-2xl border border-ink-200 bg-white/80 shadow-soft min-h-[72px] overflow-hidden">
        {files.length === 0 ? (
          <div data-tour="queue" className="px-4 py-5 text-center text-xs text-ink-400">
            No files yet — drop some above
          </div>
        ) : (
          <ul className="divide-y divide-ink-100" data-tour="queue">
            {files.map((f) => (
              <li key={f.id} className="px-4 py-2.5 flex items-center gap-3 group hover:bg-ink-50/60 transition-colors">
                <FileStatusIcon status={f.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800 truncate">{f.name}</p>
                  <p className="text-[11px] text-ink-400">{formatBytes(f.size)}</p>
                </div>
                {f.status === 'done' && f.cues != null && (
                  <Badge tone="brand">{f.cues} cues</Badge>
                )}
                {f.status === 'error' && (
                  <span className="text-[11px] text-err-500">{f.error ?? 'failed'}</span>
                )}
                {f.status === 'processing' && (
                  <span className="text-[11px] text-brand-600 font-medium">processing…</span>
                )}
                {f.status === 'queued' && (
                  <span className="text-[11px] text-ink-400">queued</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(f.id)}
                  className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-err-500 transition-all p-1 rounded-lg hover:bg-err-500/10"
                  title="Remove"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent files (display only — browsers can't reopen local paths) */}
      {recentFiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-ink-400 inline-flex items-center gap-1">
            <Clock size={12} /> Recent:
          </span>
          {recentFiles.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white border border-ink-200 text-ink-600 shadow-soft"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FileStatusIcon({ status }: { status: QueueFile['status'] }) {
  if (status === 'done') return <CheckCircle2 size={16} className="text-brand-500 shrink-0" />;
  if (status === 'error') return <AlertCircle size={16} className="text-err-500 shrink-0" />;
  if (status === 'processing') return <Loader2 size={16} className="text-brand-500 shrink-0 animate-spinSlow" />;
  return <Clock size={16} className="text-ink-400 shrink-0" />;
}
