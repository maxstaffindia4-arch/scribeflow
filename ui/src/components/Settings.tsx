import { useState } from 'react';
import { ChevronDown, Settings2, Palette } from 'lucide-react';
import { Select, NumberInput, TextInput, Field, Button, StatusDot } from './ui';
import {
  MODEL_OPTIONS,
  LANGUAGE_OPTIONS,
  TRANSLATE_OPTIONS,
  DEVICE_OPTIONS,
  PRECISION_OPTIONS,
  SUB_COLORS,
  SUB_POSITIONS,
} from '@/types';

export interface Settings {
  model: string;
  language: string;
  translate: string;
  device: string;
  precision: string;
  maxChars: number;
  maxWords: number;
  linesPerCue: number;
  splitPause: number;
}

export interface AssStyle {
  font: string;
  size: number;
  color: string;
  position: string;
  bold: boolean;
}

export function SettingsGrid({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <Field label="Model" data-tour="model">
        <Select value={settings.model} onChange={(v) => set('model', v)} options={MODEL_OPTIONS} recommended />
      </Field>
      <Field label="Language" data-tour="language">
        <Select value={settings.language} onChange={(v) => set('language', v)} options={LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l }))} />
      </Field>
      <Field label="Translate to" data-tour="translate">
        <Select value={settings.translate} onChange={(v) => set('translate', v)} options={TRANSLATE_OPTIONS.map((l) => ({ value: l, label: l }))} />
      </Field>
      <Field label="Device" data-tour="device">
        <Select value={settings.device} onChange={(v) => set('device', v)} options={DEVICE_OPTIONS} />
      </Field>
      <Field label="Precision" data-tour="precision">
        <Select value={settings.precision} onChange={(v) => set('precision', v)} options={PRECISION_OPTIONS} />
      </Field>
      <Field label="Max chars / line" data-tour="maxchars">
        <NumberInput value={settings.maxChars} onChange={(v) => set('maxChars', v)} min={1} max={120} />
      </Field>
      <Field label="Max words / line" hint="0 = off" data-tour="maxwords">
        <NumberInput value={settings.maxWords} onChange={(v) => set('maxWords', v)} min={0} max={20} />
      </Field>
      <Field label="Lines per cue" data-tour="linespercue">
        <NumberInput value={settings.linesPerCue} onChange={(v) => set('linesPerCue', v)} min={1} max={4} />
      </Field>
      <Field label="Split on pauses >" hint="(sec)" data-tour="splitpause">
        <NumberInput value={settings.splitPause} onChange={(v) => set('splitPause', v)} min={0} max={5} step={0.1} suffix="s" />
      </Field>
    </div>
  );
}

export function AssStyling({ style, onChange }: { style: AssStyle; onChange: (s: AssStyle) => void }) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof AssStyle>(k: K, v: AssStyle[K]) => onChange({ ...style, [k]: v });

  return (
    <div className="rounded-2xl border border-ink-200 bg-white/70 shadow-soft overflow-hidden" data-tour="ass">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-ink-800 hover:bg-ink-50/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Palette size={15} className="text-brand-600" />
          ASS subtitle styling <span className="text-[11px] text-ink-400">(advanced)</span>
        </span>
        <ChevronDown size={16} className={`text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 border-t border-ink-100 bg-ink-50/30 animate-fadeIn">
          <Field label="Font">
            <TextInput value={style.font} onChange={(v) => set('font', v)} placeholder="Arial" />
          </Field>
          <Field label="Size">
            <NumberInput value={style.size} onChange={(v) => set('size', v)} min={8} max={96} />
          </Field>
          <Field label="Color">
            <Select value={style.color} onChange={(v) => set('color', v)} options={SUB_COLORS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Position">
            <Select value={style.position} onChange={(v) => set('position', v)} options={SUB_POSITIONS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Bold">
            <Select
              value={style.bold ? 'on' : 'off'}
              onChange={(v) => set('bold', v === 'on')}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

interface WatchFolderProps {
  path: string;
  onPathChange: (v: string) => void;
  watching: boolean;
  onToggle: () => void;
  files?: { name: string; path: string; mtimeMs: number }[];
  onQueueFile?: (f: { name: string; path: string; mtimeMs: number }) => void;
}

export function WatchFolder({ path, onPathChange, watching, onToggle, files = [], onQueueFile }: WatchFolderProps) {
  return (
    <div data-tour="watchfolder" className="rounded-2xl border border-ink-200 bg-white/70 shadow-soft p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-ink-700 inline-flex items-center gap-1.5">
          <Settings2 size={13} className="text-brand-600" /> Watch folder
        </span>
        <TextInput value={path} onChange={onPathChange} placeholder="e.g. D:\Videos\new" className="flex-1 min-w-[180px]" />
        <Button variant={watching ? 'secondary' : 'primary'} size="md" onClick={onToggle}>
          {watching ? 'Stop watching' : 'Start watching'}
        </Button>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ink-500">
        <StatusDot tone={watching ? 'active' : 'idle'} />
        {watching ? 'Watching for new media files' : 'Not watching — start to auto-queue new files in this folder'}
      </div>
      {watching && files.length === 0 && (
        <div className="text-[11px] text-ink-400">No media files found yet — drop some in the folder.</div>
      )}
      {watching && files.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-ink-400">Found:</span>
          {files.map((f) => (
            <span
              key={f.path}
              className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-white border border-ink-200 text-ink-600 shadow-soft"
            >
              {f.name}
              <button
                type="button"
                className="text-brand-600 hover:text-brand-700 font-bold"
                title="Add to queue"
                onClick={() => onQueueFile?.(f)}
              >+</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
