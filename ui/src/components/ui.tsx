import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState, useRef, useEffect } from 'react';

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; recommended?: boolean; enOnly?: boolean }[];
  recommended?: boolean;
  badge?: string;
  'data-tour'?: string;
  className?: string;
}

export function Select({ value, onChange, options, recommended, badge, className, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className={`relative ${className ?? ''}`} data-tour={rest['data-tour']}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
          open
            ? 'border-brand-400 bg-white shadow-soft ring-2 ring-brand-400/20'
            : 'border-ink-300 bg-white hover:border-ink-400 text-ink-800 shadow-soft hover:shadow'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.label}
          {recommended && <span className="text-[9px] uppercase tracking-wide text-brand-600 font-bold bg-brand-50 px-1.5 py-0.5 rounded">rec</span>}
        </span>
        <ChevronDown size={15} className={`text-ink-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {badge && (
        <span className="absolute -top-2 right-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 border border-ink-200">
          {badge}
        </span>
      )}
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-white border border-ink-200 shadow-pop py-1.5 max-h-64 overflow-auto animate-fadeInFast">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50/60 transition-colors flex items-center justify-between gap-2 ${
                o.value === value ? 'text-brand-700 bg-brand-50/40' : 'text-ink-700'
              }`}
            >
              <span className="flex items-center gap-2">
                {o.label}
                {o.recommended && (
                  <span className="text-[9px] uppercase tracking-wide text-brand-600 font-bold bg-brand-50 px-1 py-px rounded">rec</span>
                )}
                {o.enOnly && (
                  <span className="text-[9px] uppercase tracking-wider px-1 py-px rounded bg-accent-50 text-accent-600 border border-accent-100">en</span>
                )}
              </span>
              {o.value === value && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  'data-tour'?: string;
}

export function NumberInput({ value, onChange, min, max, step = 1, suffix, ...rest }: NumberInputProps) {
  return (
    <div className="relative" data-tour={rest['data-tour']}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-xl bg-white border border-ink-300 hover:border-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 outline-none text-sm text-ink-800 shadow-soft transition-all"
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  'data-tour'?: string;
}

export function TextInput({ value, onChange, placeholder, icon, className, ...rest }: TextInputProps) {
  return (
    <div className={`relative ${className ?? ''}`} data-tour={rest['data-tour']}>
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">{icon}</span>}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2 rounded-xl bg-white border border-ink-300 hover:border-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 outline-none text-sm text-ink-800 placeholder:text-ink-400 shadow-soft transition-all`}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  'data-tour'?: string;
  children: ReactNode;
}

export function Field({ label, hint, children, ...rest }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5" data-tour={rest['data-tour']}>
      <span className="text-xs font-medium text-ink-600 flex items-center gap-1.5">
        {label}
        {hint && <span className="text-ink-400 font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone?: 'default' | 'brand' | 'accent' | 'warn' | 'muted';
  className?: string;
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  const tones: Record<string, string> = {
    default: 'bg-ink-100 text-ink-600 border-ink-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    accent: 'bg-accent-50 text-accent-600 border-accent-200',
    warn: 'bg-amber-50 text-warn-600 border-amber-200',
    muted: 'bg-ink-100 text-ink-500 border-ink-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${tones[tone]} ${className ?? ''}`}>
      {children}
    </span>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
  'data-tour'?: string;
}

export function Button({ children, onClick, variant = 'primary', disabled, size = 'md', icon, className, type = 'button', title, ...rest }: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-b from-brand-400 to-brand-600 text-white font-semibold hover:from-brand-500 hover:to-brand-700 shadow-[0_4px_14px_rgba(116,68,232,0.35)] hover:shadow-[0_6px_20px_rgba(116,68,232,0.45)] hover:-translate-y-px active:translate-y-0 disabled:from-ink-200 disabled:to-ink-300 disabled:text-ink-400 disabled:shadow-none disabled:translate-y-0',
    secondary: 'bg-white text-ink-700 border border-ink-300 hover:bg-ink-50 hover:border-ink-400 shadow-soft hover:-translate-y-px active:translate-y-0',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 border border-transparent hover:border-ink-200',
    danger: 'bg-transparent text-err-500 hover:bg-err-500/8 border border-err-500/25',
  };
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-tour={rest['data-tour']}
      className={`inline-flex items-center justify-center transition-all ${variants[variant]} ${sizes[size]} disabled:cursor-not-allowed ${className ?? ''}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function StatusDot({ tone = 'idle' }: { tone?: 'idle' | 'active' | 'done' | 'error' }) {
  const tones: Record<string, string> = {
    idle: 'bg-ink-300',
    active: 'bg-brand-500 shadow-[0_0_10px_rgba(8,195,183,0.7)]',
    done: 'bg-brand-500',
    error: 'bg-err-500',
  };
  return (
    <span className={`relative inline-flex w-2 h-2 rounded-full ${tones[tone]}`}>
      {tone === 'active' && <span className="absolute inset-0 rounded-full bg-brand-400 animate-ping opacity-70" />}
    </span>
  );
}
