export type FileStatus = 'queued' | 'processing' | 'done' | 'error';

export interface TranscribeResult {
  srt: string;
  vtt: string;
  ass: string;
  cues: { start: number; end: number; text: string }[];
  cueCount: number;
  chaptersText?: string;
  chapters?: { n: number; start: number; end: number }[];
  detectedLanguage?: string;
  translated?: {
    srt: string;
    vtt: string;
    ass: string;
    cues: { start: number; end: number; text: string }[];
  } | null;
}

export interface QueueFile {
  id: string;
  name: string;
  size: number;
  status: FileStatus;
  cues?: number;
  error?: string;
  file?: File;
  objectUrl?: string;
  result?: TranscribeResult;
}

export interface SubtitleCue {
  index: number;
  start: string;
  end: string;
  text: string;
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
}

export const MODEL_OPTIONS = [
  { value: 'tiny', label: 'Tiny' },
  { value: 'base', label: 'Base', recommended: true },
  { value: 'small', label: 'Small' },
  { value: 'large-v3-turbo', label: 'Large v3 Turbo' },
  { value: 'tiny.en', label: 'Tiny.en', enOnly: true },
  { value: 'base.en', label: 'Base.en', enOnly: true },
  { value: 'small.en', label: 'Small.en', enOnly: true },
];

export const LANGUAGE_OPTIONS = [
  'Auto-detect',
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Japanese',
  'Korean',
  'Chinese',
];

export const TRANSLATE_OPTIONS = [
  'None',
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Dutch',
  'Russian',
  'Chinese',
  'Arabic',
  'Czech',
];

export const DEVICE_OPTIONS = [
  { value: 'auto', label: 'Auto (GPU if available)' },
  { value: 'directml', label: 'DirectML GPU' },
  { value: 'cpu', label: 'CPU only' },
];

export const PRECISION_OPTIONS = [
  { value: 'auto', label: 'Auto (quantized)' },
  { value: 'q8', label: 'Q8 (faster)' },
  { value: 'fp32', label: 'FP32 (best quality)' },
];

export const SUB_COLORS = ['White', 'Yellow', 'Cyan', 'Green'] as const;
export const SUB_POSITIONS = ['Bottom', 'Middle', 'Top'] as const;

export const SUPPORTED_FORMATS = ['MP3', 'WAV', 'M4A', 'FLAC', 'OGG', 'MP4', 'MKV', 'MOV', 'WebM', 'AVI'];

export const TOUR_STEPS: TourStep[] = [
  { id: 'dropzone', title: 'Welcome to ScribeFlow', body: 'Welcome to ScribeFlow — this quick tour walks you through every control, one at a time. Drop audio or video files here to begin.' },
  { id: 'queue', title: 'Queue', body: 'Files you add show up here as rows. You can queue several at once and they will process in order.' },
  { id: 'model', title: 'Model', body: 'The AI that transcribes. **Base** is the sweet spot. **.en** models are English-only and more accurate for English audio. Bigger = better but slower.' },
  { id: 'language', title: 'Language', body: 'Set the spoken language, or leave on Auto-detect and Whisper will identify it for you.' },
  { id: 'translate', title: 'Translate to', body: 'Optionally translate the transcript into another language. The translation model downloads on first use.' },
  { id: 'device', title: 'Device', body: 'Pick where the model runs. Auto uses your GPU if one is available, falling back to CPU. DirectML targets Windows GPUs.' },
  { id: 'precision', title: 'Precision', body: 'Controls model quantization. Auto balances speed and quality. Q8 is fastest; FP32 is the highest quality.' },
  { id: 'maxchars', title: 'Max chars / line', body: 'Caps how many characters fit on a single subtitle line before it wraps. 42 is a good default for readability.' },
  { id: 'maxwords', title: 'Max words / line', body: 'Optional cap on words per line. Set to 0 to turn this limit off and rely on the character limit instead.' },
  { id: 'linespercue', title: 'Lines per cue', body: 'How many lines appear in a single subtitle cue (1–4). Two lines is the standard for film and video.' },
  { id: 'splitpause', title: 'Split on pauses > (sec)', body: 'Forces a new cue when the speaker pauses longer than this many seconds. 0.7s keeps cues tight.' },
  { id: 'ass', title: 'ASS subtitle styling', body: 'Advanced styling for ASS exports — font, size, color, position, and bold. Only affects the .ass file output.' },
  { id: 'generate', title: 'Generate Subtitles', body: 'Starts transcription for every queued file. The button stays disabled until at least one file is queued.' },
  { id: 'clearcache', title: 'Clear model cache', body: 'Removes downloaded Whisper models from your machine to reclaim disk space. They re-download on next use.' },
  { id: 'watchfolder', title: 'Watch folder', body: 'Point ScribeFlow at a folder and new media files dropped there are automatically queued for transcription.' },
  { id: 'help', title: 'Help', body: 'Replay this tour any time, or find keyboard shortcuts and troubleshooting tips here.' },
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- API param mapping (UI labels -> backend codes) ----
export const LANG_TO_CODE: Record<string, string> = {
  'Auto-detect': 'auto', English: 'en', Spanish: 'es', French: 'fr', German: 'de',
  Italian: 'it', Portuguese: 'pt', Dutch: 'nl', Polish: 'pl', Japanese: 'ja',
  Korean: 'ko', Chinese: 'zh',
};
export const TRANSLATE_TO_CODE: Record<string, string> = {
  None: 'none', English: 'en', Spanish: 'es', French: 'fr', German: 'de',
  Italian: 'it', Dutch: 'nl', Russian: 'ru', Chinese: 'zh', Arabic: 'ar', Czech: 'cs',
};
export const DEVICE_TO_API: Record<string, string> = {
  auto: 'auto', directml: 'dml', cpu: 'cpu',
};
export const POSITION_TO_ALIGN: Record<string, number> = { Bottom: 2, Middle: 5, Top: 8 };
export const COLOR_TO_ASS: Record<string, string> = {
  White: 'white', Yellow: 'yellow', Cyan: 'cyan', Green: 'green',
};
