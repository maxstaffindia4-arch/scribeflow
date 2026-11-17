// ScribeFlow — client
const $ = (id) => document.getElementById(id);
const drop = $('drop'), fileInput = $('file'), queueList = $('queueList');
const goBtn = $('go'), clearBtn = $('clearQueue'), clearCacheBtn = $('clearCache'), idleHint = $('idleHint');
const modelSel = $('model'), langSel = $('language'), translateSel = $('translateTo');
const deviceSel = $('device'), dtypeSel = $('dtype');
const maxCharsEl = $('maxChars'), maxWordsEl = $('maxWords'), maxLinesEl = $('maxLines'), pauseSecEl = $('pauseSec');
const assFontEl = $('assFont'), assSizeEl = $('assSize'), assColorEl = $('assColor'), assPosEl = $('assPos'), assBoldEl = $('assBold');
const progressWrap = $('progressWrap'), barFill = $('barFill'), statusEl = $('status');
const resultsEl = $('results');
const watchDirEl = $('watchDir'), watchBtn = $('watchBtn'), watchDot = $('watchDot'), watchStatus = $('watchStatus'), watchFilesEl = $('watchFiles');
const recentWrap = $('recentWrap'), recentEl = $('recent');

const VIDEO_EXT = /\.(mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i;
const MEDIA_EXT = /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma|mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i;

// ---------- settings persistence ----------
const SETTING_IDS = ['model', 'language', 'translateTo', 'device', 'dtype', 'maxChars', 'maxWords', 'maxLines', 'pauseSec', 'assFont', 'assSize', 'assColor', 'assPos', 'assBold'];
function saveSettings() {
  const s = {};
  for (const id of SETTING_IDS) s[id] = $(id).value;
  localStorage.setItem('substudio.settings', JSON.stringify(s));
}
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('substudio.settings') || '{}');
    for (const id of SETTING_IDS) if (s[id] != null && $(id)) $(id).value = s[id];
  } catch {}
}
for (const id of SETTING_IDS) $(id).addEventListener('change', saveSettings);
for (const id of SETTING_IDS) $(id).addEventListener('input', saveSettings);

// ---------- recent files ----------
function pushRecent(name) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem('substudio.recent') || '[]'); } catch {}
  list = [name, ...list.filter(n => n !== name)].slice(0, 8);
  localStorage.setItem('substudio.recent', JSON.stringify(list));
  renderRecent();
}
function renderRecent() {
  try {
    const list = JSON.parse(localStorage.getItem('substudio.recent') || '[]');
    if (!list.length) { recentWrap.classList.add('hidden'); return; }
    recentEl.innerHTML = list.map(n => `<span class="chip"></span>`).join('');
    [...recentEl.children].forEach((el, i) => { el.textContent = list[i]; });
    recentWrap.classList.remove('hidden');
  } catch { recentWrap.classList.add('hidden'); }
}
renderRecent();

// ---------- model/language interplay ----------
const EN_COUNTERPART = { tiny: 'tiny.en', base: 'base.en', small: 'small.en', 'large-v3-turbo': null };
function isEnglishOnlyModel() { return modelSel.value.endsWith('.en'); }
function syncLanguageUI() {
  const enOnly = isEnglishOnlyModel();
  langSel.disabled = enOnly;
  langSel.title = enOnly ? 'English-only model — language is fixed' : '';
}
langSel.addEventListener('change', () => {
  if (langSel.value === 'en') {
    const counterpart = EN_COUNTERPART[modelSel.value];
    if (counterpart) modelSel.value = counterpart;
  }
  syncLanguageUI();
  saveSettings();
});
modelSel.addEventListener('change', syncLanguageUI);
loadSettings();
syncLanguageUI();

// ---------- guided tour ----------
const TOUR_STEPS = [
  { title: 'Welcome to ScribeFlow', text: 'This quick tour walks you through every control, one at a time. Press <b>Next</b> to continue, <b>Skip</b> anytime.', center: true },
  { sel: '#drop', title: 'Drop zone', text: 'Drag audio or video files here — or click to browse. Drop <b>multiple files</b> to queue them all. In Explorer, right-click a file → <b>ScribeFlow</b> does the same.' },
  { sel: '#model', title: 'Model', text: 'The AI that transcribes. <b>Base</b> is the sweet spot. <b>.en</b> models are English-only and more accurate for English audio. Bigger = better but slower.' },
  { sel: '#language', title: 'Language', text: '<b>Auto-detect</b> lets Whisper identify the spoken language. Pick a specific one to skip detection (and slightly faster).' },
  { sel: '#translateTo', title: 'Translate to', text: 'Optional second subtitle track in another language, produced by a local translation model. First use downloads ~80–300 MB per language.' },
  { sel: '#device', title: 'Device', text: '<b>Auto</b> uses your GPU via DirectML when available, else CPU. <b>DirectML</b> forces GPU; <b>CPU</b> forces CPU.' },
  { sel: '#dtype', title: 'Precision', text: '<b>Q8</b> is quantized — faster, smaller. <b>FP32</b> is full precision — best quality, slower. Auto picks Q8.' },
  { sel: '#maxChars', title: 'Max chars / line', text: 'Longest a subtitle line can be before it wraps. ~42 chars is the broadcast standard; fewer = shorter lines.' },
  { sel: '#maxWords', title: 'Max words / line', text: 'Uniform line breaks by word count (e.g. 6–8). Set to <b>0</b> to disable — char limit alone applies.' },
  { sel: '#maxLines', title: 'Lines per cue', text: 'How many lines show at once: 1–4. Two lines is the common choice for readability.' },
  { sel: '#pauseSec', title: 'Split on pauses', text: 'Cues break when speech pauses longer than this. <b>Lower</b> = more, shorter cues; <b>higher</b> = fewer, longer ones.' },
  { sel: 'details.advanced', title: 'ASS styling', text: 'Advanced: font, size, color, position and bold for <b>.ass</b> exports and <b>Burn into video</b>. Expand it to tweak.' },
  { sel: '#go', title: 'Generate', text: 'Starts transcription. Files process one at a time — progress shows model downloads and per-block status. First run per model downloads it once.' },
  { sel: '.watch-row', title: 'Watch folder', text: 'Point at a folder — media files appear as chips below; click <b>+</b> to queue them. New files show up automatically while watching.' },
  { sel: '#clearCache', title: 'Clear model cache', text: 'Deletes downloaded AI models to free disk space. They re-download automatically on next use.' },
  { sel: '#helpBtn', title: 'Help', text: 'That\'s everything! This <b>?</b> button reopens the tour anytime. Results appear below as cards with preview, editable SRT and export buttons.' },
];

let tourIdx = -1;
const tourOverlay = $('tourOverlay'), tourSpot = $('tourSpot'), tourCard = $('tourCard');
const tourStepEl = $('tourStep'), tourTitle = $('tourTitle'), tourText = $('tourText');
const tourNextBtn = $('tourNext'), tourBackBtn = $('tourBack'), tourSkipBtn = $('tourSkip');

function tourStepValid(i) {
  const s = TOUR_STEPS[i];
  if (s.center || !s.sel) return true;
  if (s.sel === 'details.advanced') return !!document.querySelector(s.sel);
  return !!document.querySelector(s.sel);
}

function positionTour() {
  const step = TOUR_STEPS[tourIdx];
  tourStepEl.textContent = `Step ${tourIdx + 1} of ${TOUR_STEPS.length}`;
  tourTitle.innerHTML = step.title;
  tourText.innerHTML = step.text;
  tourBackBtn.classList.toggle('hidden', tourIdx === 0);
  tourNextBtn.textContent = tourIdx === TOUR_STEPS.length - 1 ? 'Done' : 'Next';

  if (step.center || !step.sel) {
    tourSpot.classList.add('hidden');
    tourCard.style.left = '50%';
    tourCard.style.top = '50%';
    tourCard.style.transform = 'translate(-50%,-50%)';
    return;
  }

  const el = document.querySelector(step.sel);
  if (!el) { tourSpot.classList.add('hidden'); return; }
  if (step.sel === 'details.advanced' && !el.open) el.open = true;
  el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });

  const r = el.getBoundingClientRect();
  const pad = 6;
  tourSpot.classList.remove('hidden');
  tourSpot.style.left = (r.left - pad) + 'px';
  tourSpot.style.top = (r.top - pad) + 'px';
  tourSpot.style.width = (r.width + pad * 2) + 'px';
  tourSpot.style.height = (r.height + pad * 2) + 'px';

  // place card below spotlight if room, else above; clamp horizontally
  const cardW = 320, cardH = 190, gap = 14;
  let left = Math.min(Math.max(12, r.left + r.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
  let top = r.bottom + pad + gap;
  if (top + cardH > window.innerHeight - 12) top = Math.max(12, r.top - pad - gap - cardH);
  tourCard.style.left = left + 'px';
  tourCard.style.top = top + 'px';
  tourCard.style.transform = 'none';
}

function startTour() {
  tourIdx = -1;
  tourOverlay.classList.remove('hidden');
  tourNext();
}
function tourNext() {
  do { tourIdx++; } while (tourIdx < TOUR_STEPS.length && !tourStepValid(tourIdx));
  if (tourIdx >= TOUR_STEPS.length) { endTour(); return; }
  positionTour();
}
function tourPrev() {
  do { tourIdx--; } while (tourIdx > 0 && !tourStepValid(tourIdx));
  if (tourIdx < 0) tourIdx = 0;
  positionTour();
}
function endTour() {
  tourOverlay.classList.add('hidden');
  localStorage.setItem('substudio.tipSeen', '2');
}

tourNextBtn.addEventListener('click', tourNext);
tourBackBtn.addEventListener('click', tourPrev);
tourSkipBtn.addEventListener('click', endTour);
$('helpBtn').addEventListener('click', startTour);
document.addEventListener('keydown', (e) => {
  if (tourOverlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') endTour();
  if (e.key === 'Enter') tourNext();
});
window.addEventListener('resize', () => { if (!tourOverlay.classList.contains('hidden')) positionTour(); });
if (localStorage.getItem('substudio.tipSeen') !== '2') {
  setTimeout(startTour, 400);
}

// ---------- file queue ----------
let queue = [];
let processing = false;

function addFiles(files) {
  for (const f of files) {
    if (!f.size || !MEDIA_EXT.test(f.name)) continue;
    const el = document.createElement('div');
    el.className = 'queue-item';
    el.innerHTML = `<span class="name"></span><span class="st">queued</span>`;
    el.querySelector('.name').textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`;
    queueList.appendChild(el);
    queue.push({ file: f, el, state: 'queued' });
    pushRecent(f.name);
  }
  goBtn.disabled = false;
  clearBtn.classList.remove('hidden');
  idleHint.textContent = `${queue.length} file${queue.length === 1 ? '' : 's'} queued`;
}

// Import a local file by path (watch folder / shell integration) via server stream
async function addLocalFile(path) {
  try {
    const res = await fetch('/api/local-file?path=' + encodeURIComponent(path));
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const blob = await res.blob();
    const name = decodeURIComponent((res.headers.get('content-disposition') || '').match(/filename\*=UTF-8''([^;]+)/)?.[1] || path.split(/[\\/]/).pop());
    addFiles([new File([blob], name, { type: blob.type || 'application/octet-stream' })]);
  } catch (e) {
    statusEl.textContent = 'Import failed: ' + e.message;
    statusEl.classList.add('error');
  }
}

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) addFiles([...fileInput.files]);
  fileInput.value = '';
});
clearBtn.addEventListener('click', () => {
  queue = [];
  queueList.innerHTML = '';
  goBtn.disabled = true;
  clearBtn.classList.add('hidden');
  idleHint.textContent = 'Pick files to begin';
});
clearCacheBtn.addEventListener('click', async () => {
  if (!confirm('Delete all downloaded Whisper/translation models? They will re-download on next use.')) return;
  await fetch('/api/cache/clear', { method: 'POST', body: JSON.stringify({ scope: 'models' }) });
  statusEl.textContent = 'Model cache cleared.';
});

function setQueueItem(item, state, text) {
  item.state = state;
  item.el.className = `queue-item ${state === 'done' ? 'done' : state === 'error' ? 'error' : state === 'active' ? 'active' : ''}`;
  item.el.querySelector('.st').textContent = text;
}

// ---------- status polling ----------
let pollTimer = null;
function fmtMB(b) { return (b / 1024 / 1024).toFixed(0); }
async function pollStatus() {
  try {
    const j = await (await fetch('/api/status')).json();
    if (!j.busy) { clearInterval(pollTimer); pollTimer = null; return; }
    let text = '';
    if (j.stage === 'receiving') text = 'Receiving file…';
    else if (j.stage === 'extracting-audio') text = 'Extracting audio with ffmpeg…';
    else if (j.stage === 'loading-model') {
      if (j.progress && j.progress.status === 'progress' && j.progress.file) {
        const pct = j.progress.progress != null ? Math.round(j.progress.progress * 100) : null;
        text = `Downloading model: ${j.progress.file}` + (pct != null ? ` — ${pct}% (${fmtMB(j.progress.loaded || 0)}/${fmtMB(j.progress.total || 0)} MB)` : '…');
        if (pct != null) barFill.style.width = pct + '%';
      } else text = 'Loading model (first run downloads it)…';
    } else if (j.stage === 'transcribing') {
      text = j.totalBlocks
        ? `Transcribing block ${j.block}/${j.totalBlocks} locally…`
        : 'Transcribing locally…';
      if (j.totalBlocks) barFill.style.width = Math.round((j.block / j.totalBlocks) * 100) + '%';
    } else if (j.stage === 'building-srt') text = 'Building subtitles…';
    else if (j.stage === 'translating') {
      text = j.totalCues ? `Translating cue ${j.cue}/${j.totalCues}…` : 'Loading translation model…';
    }
    else if (j.stage === 'burning') text = 'Burning subtitles into video…';
    else text = j.stage;
    statusEl.textContent = text;
    statusEl.classList.remove('error');
  } catch {}
}

// ---------- processing ----------
goBtn.addEventListener('click', async () => {
  if (!queue.length || processing) return;
  processing = true;
  goBtn.disabled = true;
  progressWrap.style.display = 'block';
  progressWrap.classList.add('indeterminate');
  barFill.style.width = '0%';
  statusEl.classList.remove('error');
  pollTimer = setInterval(pollStatus, 800);

  const pending = queue.filter(q => q.state === 'queued' || q.state === 'error');
  for (const item of pending) {
    setQueueItem(item, 'active', 'processing…');
    progressWrap.classList.add('indeterminate');
    pollStatus();
    try {
      const result = await processFile(item.file);
      setQueueItem(item, 'done', `${result.cueCount} cues`);
      renderResult(result);
    } catch (e) {
      setQueueItem(item, 'error', e.message);
      statusEl.textContent = `${item.file.name}: ${e.message}`;
      statusEl.classList.add('error');
    }
  }
  clearInterval(pollTimer);
  pollTimer = null;
  progressWrap.classList.remove('indeterminate');
  barFill.style.width = '100%';
  processing = false;
  goBtn.disabled = queue.length === 0;
  idleHint.textContent = 'Done — results below';
});

async function processFile(file) {
  const params = new URLSearchParams({
    filename: file.name,
    model: modelSel.value,
    language: langSel.value,
    translateTo: translateSel.value,
    device: deviceSel.value,
    dtype: dtypeSel.value,
    maxChars: maxCharsEl.value || 42,
    maxWords: maxWordsEl.value || 0,
    maxLines: maxLinesEl.value || 2,
    pauseSec: pauseSecEl.value || 0.7,
    assFont: assFontEl.value || 'Arial',
    assSize: assSizeEl.value || 16,
    assColor: assColorEl.value || 'white',
    assPos: assPosEl.value || 2,
    assBold: assBoldEl.value || 0,
  });
  const res = await fetch('/api/transcribe?' + params, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return {
    file,
    name: file.name,
    base: file.name.replace(/\.[^.]+$/, ''),
    isVideo: VIDEO_EXT.test(file.name),
    isAudio: MEDIA_EXT.test(file.name) && !VIDEO_EXT.test(file.name),
    objectUrl: URL.createObjectURL(file),
    srt: j.srt, vtt: j.vtt, ass: j.ass,
    cues: j.cues || [],
    cueCount: j.cueCount || 0,
    chapters: j.chapters || [],
    chaptersText: j.chaptersText || '',
    detectedLanguage: j.detectedLanguage || null,
    translated: j.translated || null,
    text: j.text || '',
  };
}

// ---------- SRT parse / validate (for preview re-sync + lint) ----------
function parseSrt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').filter(l => l !== undefined);
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->').map(s => s.trim());
    const toSec = (s) => {
      const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!m) return null;
      return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    };
    const start = toSec(a), end = toSec(z);
    if (start == null || end == null) continue;
    cues.push({ start, end, text: lines.slice(ti + 1).join(' ') });
  }
  return cues;
}
function validateSrt(text) {
  const issues = [];
  const cues = parseSrt(text);
  if (!cues.length) return { cues, issues: ['No valid cues found'] };
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].end <= cues[i].start) issues.push(`Cue ${i + 1}: end <= start`);
    if (i > 0 && cues[i].start < cues[i - 1].end - 0.01) issues.push(`Cue ${i + 1}: overlaps previous`);
  }
  return { cues, issues };
}

// ---------- result rendering ----------
function fmtClock(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function highlight(text, q) {
  const e = escHtml(text);
  if (!q) return e;
  const eq = escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return e.replace(new RegExp(`(${eq})`, 'gi'), '<mark>$1</mark>');
}

function download(content, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderResult(r) {
  const card = document.createElement('div');
  card.className = 'card result-card';

  const head = document.createElement('div');
  head.className = 'result-head';
  const badges = `${r.cueCount} cues` +
    (r.detectedLanguage && r.detectedLanguage !== 'en' ? ` · ${r.detectedLanguage}` : '') +
    (r.chapters.length > 1 ? ` · ${r.chapters.length} chapters` : '');
  head.innerHTML = `<span class="title"></span><span><span class="badge"></span></span>`;
  head.querySelector('.title').textContent = r.name;
  head.querySelector('.badge').textContent = badges;
  card.appendChild(head);

  // preview
  const preview = document.createElement('div');
  preview.className = 'preview';
  const mediaBox = document.createElement('div');
  mediaBox.className = 'media-box';
  let media = null;
  if (r.isVideo || r.isAudio) {
    media = document.createElement(r.isVideo ? 'video' : 'audio');
    media.controls = true;
    media.preload = 'metadata';
    media.src = r.objectUrl;
    mediaBox.appendChild(media);
  } else {
    mediaBox.innerHTML = '<span style="color:#8b93a7;font-size:13px">No preview for this format</span>';
  }
  preview.appendChild(mediaBox);

  const pane = document.createElement('div');
  pane.className = 'cue-pane';
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'search-box';
  search.placeholder = 'Search subtitles…';
  search.style.cssText = 'width:100%;background:rgba(0,0,0,0.3);color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 12px;font-size:13px;outline:none;';
  pane.appendChild(search);

  const cueList = document.createElement('div');
  cueList.className = 'cue-list';
  const state = { cues: r.cues, query: '', activeIdx: -1, els: [] };

  function renderCues() {
    cueList.innerHTML = '';
    state.els = [];
    const q = state.query.trim().toLowerCase();
    state.cues.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'cue';
      el.innerHTML = `<div class="t"></div><div class="x"></div>`;
      el.querySelector('.t').textContent = fmtClock(c.start);
      el.querySelector('.x').innerHTML = highlight(c.text, q);
      if (q && !c.text.toLowerCase().includes(q)) el.classList.add('dim');
      el.addEventListener('click', () => {
        if (media) { media.currentTime = c.start; media.play?.(); }
      });
      cueList.appendChild(el);
      state.els.push(el);
    });
  }
  renderCues();
  search.addEventListener('input', () => { state.query = search.value; renderCues(); });
  pane.appendChild(cueList);
  preview.appendChild(pane);
  card.appendChild(preview);

  if (media) {
    media.addEventListener('timeupdate', () => {
      const t = media.currentTime;
      let idx = -1;
      for (let i = 0; i < state.cues.length; i++) {
        if (t >= state.cues[i].start && t < state.cues[i].end) { idx = i; break; }
        if (t < state.cues[i].start) break;
      }
      if (idx !== state.activeIdx) {
        if (state.activeIdx >= 0) state.els[state.activeIdx]?.classList.remove('active');
        state.activeIdx = idx;
        if (idx >= 0) {
          state.els[idx].classList.add('active');
          state.els[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    });
  }

  // editable SRT + validation
  const lbl = document.createElement('div');
  lbl.className = 'section-label';
  lbl.innerHTML = `SRT (editable) <span class="badge warn hidden" id="vbadge"></span>`;
  card.appendChild(lbl);
  const ta = document.createElement('textarea');
  ta.spellcheck = false;
  ta.value = r.srt;
  card.appendChild(ta);

  const vbadge = lbl.querySelector('#vbadge');
  let validateTimer = null;
  ta.addEventListener('input', () => {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      const { issues } = validateSrt(ta.value);
      if (issues.length) {
        vbadge.textContent = `${issues.length} issue${issues.length > 1 ? 's' : ''}`;
        vbadge.title = issues.slice(0, 8).join('\n');
        vbadge.classList.remove('hidden');
        ta.classList.add('warn-border');
      } else {
        vbadge.classList.add('hidden');
        ta.classList.remove('warn-border');
      }
    }, 400);
  });

  // actions
  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const mkBtn = (label, fn, primary = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = primary ? '' : 'secondary';
    b.addEventListener('click', fn);
    actions.appendChild(b);
    return b;
  };

  mkBtn('SRT', () => download(ta.value, r.base + '.srt', 'application/x-subrip'), true);
  mkBtn('VTT', () => download(r.vtt, r.base + '.vtt', 'text/vtt'));
  mkBtn('ASS', () => download(r.ass, r.base + '.ass', 'text/plain'));
  if (r.chaptersText) mkBtn('Chapters.txt', () => download(r.chaptersText, r.base + '.chapters.txt', 'text/plain'));
  mkBtn('Copy SRT', async (e) => {
    await navigator.clipboard.writeText(ta.value);
    e.target.textContent = 'Copied!';
    setTimeout(() => (e.target.textContent = 'Copy SRT'), 1500);
  });
  mkBtn('Re-parse cues', () => {
    const { cues, issues } = validateSrt(ta.value);
    if (cues.length) {
      state.cues = cues;
      state.activeIdx = -1;
      renderCues();
      if (issues.length) alert(`Parsed ${cues.length} cues with ${issues.length} issue(s).`);
    } else {
      alert('Could not parse any cues from the SRT text.');
    }
  });
  if (r.isVideo) {
    mkBtn('Burn into video…', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Storing subs…';
      try {
        const sr = await fetch('/api/store-sub', { method: 'POST', body: ta.value });
        const { id } = await sr.json();
        e.target.textContent = 'Burning…';
        const br = await fetch(`/api/burn?sub=${id}&filename=${encodeURIComponent(r.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: r.file,
        });
        if (!br.ok) {
          const j = await br.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${br.status}`);
        }
        const blob = await br.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = r.base + '-subbed.mp4';
        a.click();
        URL.revokeObjectURL(a.href);
        e.target.textContent = 'Done ✓';
      } catch (err) {
        alert('Burn failed: ' + err.message);
        e.target.textContent = 'Burn into video…';
      } finally {
        e.target.disabled = false;
      }
    });
  }
  card.appendChild(actions);

  // translated output
  if (r.translated) {
    const tlbl = document.createElement('div');
    tlbl.className = 'section-label';
    tlbl.textContent = `Translated subtitles (${translateSel.value.toUpperCase()})`;
    card.appendChild(tlbl);
    const tta = document.createElement('textarea');
    tta.spellcheck = false;
    tta.value = r.translated.srt;
    tta.style.height = '200px';
    card.appendChild(tta);
    const tActions = document.createElement('div');
    tActions.className = 'result-actions';
    const tmk = (label, fn, primary = false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = primary ? '' : 'secondary';
      b.addEventListener('click', fn);
      tActions.appendChild(b);
    };
    tmk('Translated SRT', () => download(r.translated.srt, `${r.base}.${translateSel.value}.srt`, 'application/x-subrip'), true);
    tmk('Translated VTT', () => download(r.translated.vtt, `${r.base}.${translateSel.value}.vtt`, 'text/vtt'));
    tmk('Translated ASS', () => download(r.translated.ass, `${r.base}.${translateSel.value}.ass`, 'text/plain'));
    card.appendChild(tActions);
  }

  resultsEl.prepend(card);
}

// ---------- watch folder ----------
let watching = false;
let watchTimer = null;
const enqueuedWatch = new Set(); // path+mtime keys already queued

watchBtn.addEventListener('click', async () => {
  const dir = watchDirEl.value.trim();
  if (!dir) return;
  if (watching) {
    await fetch('/api/watch', { method: 'POST', body: JSON.stringify({ action: 'stop' }) });
    watching = false;
    watchBtn.textContent = 'Start watching';
    watchDot.classList.remove('on');
    watchStatus.textContent = '';
    watchFilesEl.innerHTML = '';
    clearInterval(watchTimer);
    return;
  }
  const res = await fetch('/api/watch', { method: 'POST', body: JSON.stringify({ action: 'start', path: dir }) });
  const j = await res.json();
  if (!res.ok) { watchStatus.textContent = j.error || 'Failed'; watchStatus.classList.add('error'); return; }
  watching = true;
  watchBtn.textContent = 'Stop watching';
  watchDot.classList.add('on');
  watchStatus.classList.remove('error');
  watchStatus.textContent = `${j.count} media file(s) found`;
  watchTimer = setInterval(pollWatch, 3000);
  pollWatch();
});

async function pollWatch() {
  if (!watching) return;
  try {
    const j = await (await fetch('/api/watch')).json();
    if (!j.watching) { watching = false; watchBtn.textContent = 'Start watching'; watchDot.classList.remove('on'); clearInterval(watchTimer); return; }
    watchFilesEl.innerHTML = '';
    for (const f of j.files.slice(0, 30)) {
      const key = `${f.path}|${f.mtimeMs}`;
      const span = document.createElement('span');
      span.className = 'wf';
      span.textContent = f.name;
      if (!enqueuedWatch.has(key)) {
        span.style.cursor = 'pointer';
        span.title = 'Click to add to queue';
        span.addEventListener('click', () => { enqueuedWatch.add(key); addLocalFile(f.path); });
        span.textContent += ' +';
      }
      watchFilesEl.appendChild(span);
    }
    watchStatus.textContent = `${j.files.length} media file(s) in folder — click + to queue`;
  } catch {}
}

// ---------- shell integration / ?open= param ----------
const openParam = new URLSearchParams(location.search).get('open');
if (openParam) addLocalFile(openParam);
