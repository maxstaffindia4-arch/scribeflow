# Project memory

## Product intent & audience

- **ScribeFlow**: local desktop-style web app that transcribes audio/video into word-timed subtitles via a local Whisper model.
- Currently built as a fully-featured interactive front-end only; transcription/Whisper behavior is simulated, not real.
- Audience: privacy-conscious users wanting offline, free subtitle generation.

## Brand personality & voice

- Desktop productivity tool aesthetic: capable, technical, calm.
- UI copy is concise and instructional (e.g., "Pick files to begin", "Drop audio or video here").
- Help/educational tone in guided tour body text with bold emphasis on key terms.

## Visual design & UX direction

- Dark theme throughout, suited for a desktop app.
- Primary CTA uses a gradient; secondary actions are ghost buttons.
- Large prominent drop zone with subtle animated/pulsing border in empty state.
- Responsive settings grid for dropdowns and number inputs.
- Progress bar uses animated shimmer; status line cycles through realistic stages (ffmpeg extract → model download → transcribe block → translate cue).
- Result card: two-column layout (16:9 media preview left, searchable scrollable subtitle cue list right), monospace SRT textarea below, download action row.
- Guided tour: dimmed overlay with glowing spotlight cutout that follows targeted controls; tooltip card with step indicator and Skip/Back/Next.
- Empty state: film-strip/subtitle icon placeholder below input card.
- Status badges and chips used for file states, recent files, watch-folder files, and result metadata.

## Decisions, constraints & rationale

- Framework: vite-react with JSX, Tailwind, React hooks, Lucide React icons, `@/` path alias — per authoritative `.bolt/prompt`.
- No extra UI/icon packages installed.
- Single-page app with four logical states: main, result, guided tour overlay, first-run empty.
- Result card appears below input card after simulated processing.
- Tour covers 16 controls sequentially.
- Translated subtitle section shown only when a translate target is set.
- Build and type check pass cleanly; CSS font import ordered to avoid warnings.

## Open questions & assumptions

- Assumes simulated front-end is acceptable (no real Whisper/ffmpeg integration yet).
- No backend or local file-system access implemented; watch folder and file reading are mocked.
- Accessibility specifics (ARIA on tour, keyboard nav for cue list) not yet confirmed as in-scope.
- Real download/export of SRT/VTT/ASS files is simulated/generated in-browser.