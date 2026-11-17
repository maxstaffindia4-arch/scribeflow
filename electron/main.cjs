// Electron desktop wrapper: starts the Node server, then opens a native window.
const { app, BrowserWindow, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 4732;
const URL = `http://localhost:${PORT}`;

let serverProc = null;
let win = null;

function startServer() {
  // ELECTRON_RUN_AS_NODE makes the Electron binary behave as plain Node,
  // so the packaged app doesn't require a system-wide Node.js install.
  serverProc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NO_BROWSER: '1',
      SCRIBEFLOW_DATA_DIR: app.getPath('userData'),
    },
    stdio: 'inherit',
  });
  serverProc.on('exit', () => { serverProc = null; });
}

function waitForServer(tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(URL + '/api/status', (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (n <= 0) return reject(new Error('Server did not start'));
        setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(tries);
  });
}

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer();
  } catch (e) {
    console.error(e);
  }
  const iconPath = path.join(ROOT, 'assets', 'icon.png');
  win = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 640,
    minHeight: 560,
    backgroundColor: '#0b0d12',
    title: 'ScribeFlow',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: { contextIsolation: true },
  });
  // Forward a media file passed on the command line (e.g. Explorer
  // right-click -> ScribeFlow) into the UI via ?open=<path>
  const MEDIA_RE = /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma|mp4|mkv|mov|webm|avi|m4v|mpg|mpeg|wmv|flv|ts|m2ts)$/i;
  const fileArg = process.argv.find(a => MEDIA_RE.test(a)) ||
    process.argv.find(a => a.startsWith('--file='))?.slice(7);
  const target = fileArg ? `${URL}?open=${encodeURIComponent(fileArg)}` : URL;
  win.loadURL(target);
});

app.on('window-all-closed', () => {
  if (serverProc) serverProc.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProc) serverProc.kill();
});
