import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TourStep } from '@/types';
import { TOUR_STEPS } from '@/types';

interface TourOverlayProps {
  open: boolean;
  step: number;
  onClose: () => void;
  onStep: (n: number) => void;
}

export function TourOverlay({ open, step, onClose, onStep }: TourOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current: TourStep = TOUR_STEPS[step] ?? TOUR_STEPS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        onStep(Math.min(TOUR_STEPS.length - 1, step + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onStep(Math.max(0, step - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, onClose, onStep]);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${current.id}"]`) as HTMLElement | null;
    // Instant scroll — smooth scrolling made the spotlight/tooltip lag behind
    // and caused the top-left flash before the first measurement landed.
    el?.scrollIntoView({ behavior: 'auto', block: 'center' });

    let raf = 0;
    function measure() {
      const target = document.querySelector(`[data-tour="${current.id}"]`) as HTMLElement | null;
      setRect(target ? target.getBoundingClientRect() : null);
    }
    measure(); // synchronous — position is already correct after instant scroll
    raf = requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 150);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, current.id]);

  if (!open) return null;

  const total = TOUR_STEPS.length;
  const isLast = step >= total - 1;

  const pad = 12;
  const tooltipW = 320;
  // When there's no spotlight target (rect null), center the tooltip
  // instead of pinning it to the top-left corner.
  let left = rect ? rect.left + rect.width / 2 - tooltipW / 2 : (window.innerWidth - tooltipW) / 2;
  let top = rect ? rect.bottom + pad : window.innerHeight * 0.35;

  if (typeof window !== 'undefined') {
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));
    if (rect && top + 220 > window.innerHeight) {
      top = rect.top - 220 - pad;
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Dim overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 8}
                y={rect.top - 8}
                width={rect.width + 16}
                height={rect.height + 16}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(15,23,42,0.55)" mask="url(#tour-mask)" />
      </svg>

      {/* Glowing ring around target */}
      {rect && (
        <div
          className="absolute rounded-xl border-2 border-brand-500 pointer-events-none animate-spotlight"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      {/* Close on backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl glass-strong border border-ink-200 shadow-lift p-4 animate-fadeIn"
        style={{ left, top, width: tooltipW }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-brand-600 font-bold">
            Step {step + 1} of {total}
          </span>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors p-1 rounded-lg hover:bg-ink-100">
            <X size={14} />
          </button>
        </div>
        <h4 className="text-sm font-semibold text-ink-900 mb-1.5">{current.title}</h4>
        <p
          className="text-[13px] text-ink-600 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: current.body.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-700 font-semibold">$1</strong>'),
          }}
        />
        <div className="flex items-center justify-between mt-4">
          <button type="button" onClick={onClose} className="text-xs text-ink-500 hover:text-ink-700 transition-colors">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onClose() : onStep(step + 1))}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-b from-brand-400 to-brand-600 text-white font-semibold hover:from-brand-500 hover:to-brand-700 shadow-[0_3px_10px_rgba(16,185,129,0.35)] transition-all"
            >
              {isLast ? 'Done' : 'Next'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
