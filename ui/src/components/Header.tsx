import { HelpCircle } from 'lucide-react';

interface HeaderProps {
  onHelp: () => void;
}

export function Header({ onHelp }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass border-b border-ink-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-ink-200 shadow-soft shrink-0 overflow-hidden">
            <img src="/favicon.png" alt="ScribeFlow" className="w-8 h-8 object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-ink-900 leading-tight tracking-tight">
              Scribe<span className="gradient-text">Flow</span>
            </h1>
            <p className="text-[11px] text-ink-500 leading-tight truncate hidden sm:block">
              Local Whisper transcription → word-timed subtitles. Free, private, offline after model download.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onHelp}
          data-tour="help"
          title="Help & tour"
          className="shrink-0 w-10 h-10 rounded-full border border-ink-300 bg-white/80 hover:bg-white hover:border-brand-400 text-ink-600 hover:text-brand-600 flex items-center justify-center transition-all shadow-soft hover:shadow"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </header>
  );
}
