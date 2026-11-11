// Electron 主程序：用自訂 app:// 協定載入打包好的網頁，並提供不受 CORS 限制的行情抓取。
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const ALLOWED_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'openapi.twse.com.tw',
  'www.tpex.org.tw',
];
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const DIST = path.join(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

ipcMain.handle('http-get', async (_e, url) => {
  let host;
  try { host = new URL(url).host; } catch { return { status: 0, body: '', error: 'bad url' }; }
  if (!ALLOWED_HOSTS.includes(host)) return { status: 0, body: '', error: 'host not allowed' };
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,*/*' } });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: '', error: String(err) };
  }
});

// ---------------- 自動更新（GitHub Releases） ----------------
let mainWin = null;
const updState = { status: 'idle', version: null, percent: 0, notes: '', error: '' };
function sendUpd(p) {
  Object.assign(updState, p);
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-status', updState);
}
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true; // 下載完成後，下次關閉程式時自動安裝
autoUpdater.on('checking-for-update', () => sendUpd({ status: 'checking', error: '' }));
autoUpdater.on('update-not-available', () => sendUpd({ status: 'latest' }));
autoUpdater.on('update-available', (i) => sendUpd({ status: 'downloading', version: i.version, percent: 0, notes: notesText(i.releaseNotes) }));
autoUpdater.on('download-progress', (p) => sendUpd({ status: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (i) => sendUpd({ status: 'ready', version: i.version, percent: 100, notes: notesText(i.releaseNotes) }));
autoUpdater.on('error', (e) => sendUpd({ status: 'error', error: String((e && e.message) || e).slice(0, 300) }));
function notesText(n) {
  if (!n) return '';
  if (Array.isArray(n)) n = n.map((x) => x.note).join('\n');
  return String(n).replace(/<[^>]+>/g, '').trim().slice(0, 2000);
}
function checkUpdates() {
  if (!app.isPackaged) { sendUpd({ status: 'dev' }); return; }
  autoUpdater.checkForUpdates().catch((e) => sendUpd({ status: 'error', error: String(e).slice(0, 300) }));
}
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('update-state', () => updState);
ipcMain.handle('update-check', () => { checkUpdates(); return true; });
ipcMain.handle('update-install', () => { setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; });

function createWindow() {
  const win = (mainWin = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    backgroundColor: '#0f1420',
    title: '股市模擬學習平台',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': type } });
  });
  createWindow();
  setTimeout(checkUpdates, 5000);
  setInterval(checkUpdates, 4 * 60 * 60 * 1000); // 每 4 小時檢查一次
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
