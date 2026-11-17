import { Film } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border-2 border-dashed border-ink-200 bg-gradient-to-br from-white to-ink-50/50 shadow-soft">
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-mesh rounded-3xl blur-xl opacity-60" />
        <div className="relative w-20 h-20 rounded-2xl bg-white border border-ink-200 flex items-center justify-center text-brand-500 shadow-soft animate-float">
          <Film size={36} strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-base font-medium text-ink-800">Your subtitles will appear here</h3>
      <p className="text-sm text-ink-400 mt-1.5 max-w-xs">
        Drop an audio or video file to get started
      </p>
    </div>
  );
}
