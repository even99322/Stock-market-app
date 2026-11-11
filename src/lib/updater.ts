// 自動更新：電腦版由 electron-updater 處理；Android 版查詢 GitHub Releases 後下載 APK 交給系統安裝。
import { CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { useSyncExternalStore } from 'react';
import { platform } from './http';

export const REPO = 'even99322/Stock-market-app';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export type UpdStatus = 'idle' | 'dev' | 'checking' | 'latest' | 'available' | 'downloading' | 'ready' | 'need-permission' | 'error';
export interface UpdState {
  status: UpdStatus;
  current: string;
  version?: string | null;
  percent?: number;
  notes?: string;
  error?: string;
  apkUrl?: string;
}

interface ApkUpdaterPlugin {
  getVersion(): Promise<{ versionName: string; versionCode: number }>;
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(o: { url: string }): Promise<void>;
  installDownloaded(): Promise<void>;
  addListener(ev: 'progress', cb: (d: { percent: number }) => void): Promise<PluginListenerHandle>;
}
const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

let state: UpdState = { status: 'idle', current: __APP_VERSION__ };
const subs = new Set<() => void>();
function set(p: Partial<UpdState>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export const useUpdate = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);

/** 比較版本 1.2.10 > 1.2.9 */
export function newer(a: string, b: string) {
  const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x) || 0);
  const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

let started = false;
export async function initUpdater() {
  if (started) return;
  started = true;
  const p = platform();
  if (p === 'electron') {
    const b = window.stockBridge!;
    set({ current: await b.version() });
    b.update.onStatus((s) => set({ ...s, status: s.status === 'idle' ? 'idle' : s.status }));
    const s = await b.update.state();
    if (s.status !== 'idle') set(s);
  } else if (p === 'android') {
    try { set({ current: (await ApkUpdater.getVersion()).versionName }); } catch { /* ignore */ }
    ApkUpdater.addListener('progress', (d) => set({ status: 'downloading', percent: d.percent }));
    setTimeout(() => checkNow(true), 4000);
    setInterval(() => document.visibilityState === 'visible' && checkNow(true), 6 * 3600 * 1000);
  } else {
    set({ status: 'dev' });
  }
}

/** auto=true 時找到新版會直接開始下載 */
export async function checkNow(auto = false) {
  const p = platform();
  if (p === 'electron') { await window.stockBridge!.update.check(); return; }
  if (p !== 'android') { set({ status: 'dev' }); return; }
  if (state.status === 'downloading') return;
  set({ status: 'checking', error: '' });
  try {
    const r = await CapacitorHttp.get({
      url: `https://api.github.com/repos/${REPO}/releases/latest`,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'StockSim-Android' },
    });
    if (r.status !== 200) throw new Error(`GitHub 回應 ${r.status}`);
    const rel = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    const ver = String(rel.tag_name || '').replace(/^v/, '');
    const apk = (rel.assets || []).find((a: any) => /\.apk$/i.test(a.name));
    if (!ver || !apk || !newer(ver, state.current)) { set({ status: 'latest' }); return; }
    set({ status: 'available', version: ver, notes: String(rel.body || '').slice(0, 2000), apkUrl: apk.browser_download_url });
    if (auto) await downloadApk();
  } catch (e: any) {
    set({ status: 'error', error: e?.message || String(e) });
  }
}

export async function downloadApk() {
  if (!state.apkUrl) return;
  const { allowed } = await ApkUpdater.canInstall();
  if (!allowed) { set({ status: 'need-permission' }); return; }
  set({ status: 'downloading', percent: 0 });
  try {
    await ApkUpdater.downloadAndInstall({ url: state.apkUrl });
    set({ status: 'ready', percent: 100 });
  } catch (e: any) {
    set({ status: 'error', error: e?.message || String(e) });
  }
}

export async function openInstallPermission() {
  await ApkUpdater.openInstallSettings();
}

/** 電腦：重新啟動並安裝；Android：再次開啟系統安裝畫面 */
export async function installNow() {
  const p = platform();
  if (p === 'electron') await window.stockBridge!.update.install();
  else if (p === 'android') {
    try { await ApkUpdater.installDownloaded(); } catch { await downloadApk(); }
  }
}
