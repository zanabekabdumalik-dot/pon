// GeneGuard AI for Windows: the GeneGuard web app in its own window, fully offline.
//
// The app files (built into ../dist-desktop, shipped as resources/web) are served from a
// private app://geneguard/ address, so OCR, PDF reading and the built-in engine run exactly
// as on the web. Nothing is uploaded, no server is started, and the app contains no API keys.

const { app, BrowserWindow, Menu, nativeTheme, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const SCHEME = 'app';
const HOST = 'geneguard';
const ORIGIN = `${SCHEME}://${HOST}`;
const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'dist-desktop');
const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, 'build', 'icon.png');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.vcf': 'text/plain; charset=utf-8',
  '.gz': 'application/octet-stream',
};

// Only this app's own files; nothing is loaded from the internet.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

async function serveAppFile(request) {
  const url = new URL(request.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(webRoot, rel);
  if (url.host !== HOST || !file.startsWith(webRoot + path.sep)) return new Response('Not found', { status: 404 });
  try {
    const body = await fs.readFile(file);
    const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    if (file.endsWith('.html')) headers['Content-Security-Policy'] = CSP;
    return new Response(body, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const isAppUrl = (url) => url.startsWith(`${ORIGIN}/`);
const openOutside = (url) => {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
};

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'GeneGuard AI',
    icon: iconPath,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#060c18' : '#f3f6fb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Links to ClinVar, MedlinePlus and other sources open in the normal web browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(`${ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle(SCHEME, serveAppFile);
    // The app needs no camera, microphone, location or notifications — only copying the report text.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
