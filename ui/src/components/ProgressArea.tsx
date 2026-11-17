import { Loader2, Cpu, Download, Volume2, Languages } from 'lucide-react';

interface ProgressAreaProps {
  active: boolean;
  stage: string;
  percent: number;
}

export function ProgressArea({ active, stage, percent }: ProgressAreaProps) {
  if (!active) return null;
  return (
    <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50/80 to-accent-50/40 p-4 flex flex-col gap-2 shadow-soft animate-fadeIn" data-tour="generate">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-brand-700 font-medium">
          <Loader2 size={14} className="animate-spinSlow" />
          {stage}
        </span>
        <span className="text-ink-500 tabular-nums font-medium">{Math.round(percent)}%</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-white/80 overflow-hidden shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
          style={{ width: `${percent}%` }}
        />
        <div className="absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

export const PROGRESS_STAGES = [
  { stage: 'Extracting audio with ffmpeg…', icon: Volume2, percent: 8 },
  { stage: 'Downloading model: whisper-base — 45% (210/470 MB)', icon: Download, percent: 45 },
  { stage: 'Transcribing block 2/5 locally…', icon: Cpu, percent: 72 },
  { stage: 'Translating cue 12/48…', icon: Languages, percent: 90 },
];
