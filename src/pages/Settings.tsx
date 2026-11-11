import { useState } from 'react';
import { Help, useUi } from '../components/ui';
import { platform } from '../lib/http';
import { loadTwData } from '../lib/names';
import { DEFAULT_FIREBASE_CONFIG, DEFAULT_SETTINGS, store, useApp } from '../lib/store';
import { forceDownload, forceUpload, initSync, login, logout, parseConfig, resetPassword, useSync } from '../lib/sync';
import type { AppState, Settings } from '../lib/types';
import { checkNow, downloadApk, installNow, RELEASES_URL, useUpdate } from '../lib/updater';

export function SettingsPage() {
  const app = useApp();
  const { toast } = useUi();
  const s = app.settings;
  const set = (p: Partial<Settings>) => store.update((st) => ({ ...st, settings: { ...st.settings, ...p } }));
  const numField = (label: string, key: keyof Settings, step = 1, help?: string) => (
    <label className="field">
      <span>{label}{help && <Help id={help} />}</span>
      <input type="number" step={step} value={s[key] as number} onChange={(e) => set({ [key]: parseFloat(e.target.value) || 0 } as any)} />
    </label>
  );

  return (
    <div className="page">
      <div className="page-head"><h2>設定</h2><span className="muted small">平台：{platform() === 'electron' ? 'Windows 桌面版' : platform() === 'android' ? 'Android App' : '瀏覽器'}</span></div>

      <UpdateCard />
      <SyncCard />

      <div className="card">
        <div className="card-title">交易成本</div>
        <div className="form-grid">
          {numField('台股手續費折數（0.6 = 六折）', 'twFeeDiscount', 0.05, 'fees')}
          {numField('台股最低手續費（元）', 'twMinFee')}
          {numField('美股每筆手續費（USD）', 'usCommission', 0.5)}
        </div>
      </div>

      <div className="card">
        <div className="card-title">顯示與更新</div>
        <label className="chk"><input type="checkbox" checked={s.redUp} onChange={(e) => set({ redUp: e.target.checked })} />台灣慣例：紅漲綠跌（取消則為美式綠漲紅跌）</label>
        <div className="form-grid">
          {numField('報價自動更新間隔（秒）', 'refreshSec', 5)}
        </div>
        <button className="btn sm ghost" onClick={() => loadTwData(true).then(() => toast('已更新台股清單與本益比資料'))}>重新下載台股清單／本益比</button>
      </div>

      <div className="card">
        <div className="card-title">財報資料來源</div>
        <p className="muted small">台股財報與產業分類來自 FinMind（免費、免註冊即可使用，但每小時查詢次數有限）。若常看到「查詢次數上限」錯誤，可到 finmindtrade.com 免費註冊，把 API Token 貼在下面提高上限。美股財報來自 Yahoo Finance。</p>
        <label className="field"><span>FinMind API Token（選填）</span>
          <input type="password" value={s.finmindToken || ''} placeholder="未填寫" onChange={(e) => set({ finmindToken: e.target.value.trim() })} />
        </label>
      </div>

      <div className="card">
        <div className="card-title">模擬帳戶初始資金（重置帳戶時套用）</div>
        <div className="form-grid">
          {numField('台幣', 'initialTWD', 10000)}
          {numField('美元', 'initialUSD', 1000)}
        </div>
      </div>

      <BackupCard />

      <div className="card">
        <div className="card-title">還原預設</div>
        <button className="btn sm ghost" onClick={() => confirm('把交易成本與顯示設定還原為預設？') && set({ ...DEFAULT_SETTINGS, firebaseConfig: s.firebaseConfig, firebaseOptOut: s.firebaseOptOut })}>還原設定預設值</button>
      </div>
    </div>
  );
}

function SyncCard() {
  const app = useApp();
  const sync = useSync();
  const { toast } = useUi();
  const [cfg, setCfg] = useState(app.settings.firebaseConfig);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(!app.settings.firebaseConfig);

  const saveCfg = async () => {
    if (cfg.trim() && !parseConfig(cfg)) return toast('無法解析設定，請貼上 Firebase 主控台的 firebaseConfig 物件', 'err');
    store.update((st) => ({ ...st, settings: { ...st.settings, firebaseConfig: cfg, firebaseOptOut: !cfg.trim() } }));
    await initSync();
    toast(cfg.trim() ? 'Firebase 設定已儲存' : '已關閉雲端同步');
  };
  const doLogin = async (register: boolean) => {
    setBusy(true);
    try { await login(email, pw, register); toast(register ? '註冊成功，開始同步' : '登入成功，開始同步'); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };
  const label: Record<string, string> = {
    off: '未啟用', 'signed-out': '尚未登入', connecting: '連線中…', synced: '已同步', syncing: '同步中…', error: '錯誤',
  };

  return (
    <div className="card">
      <div className="card-title">雲端同步（電腦 ↔ 手機）<span className={`badge ${sync.status === 'synced' ? '' : sync.status === 'error' ? 'warn' : ''}`}>{label[sync.status]}</span></div>
      {sync.message && <div className="note warn">{sync.message}</div>}

      {sync.status === 'off' || sync.status === 'error' ? (
        <>
          <button className="link" onClick={() => setShowGuide(!showGuide)}>{showGuide ? '收起設定教學' : '如何設定？'}</button>
          {showGuide && (
            <ol className="small guide-list">
              <li>到 <b>console.firebase.google.com</b> 建立專案（免費 Spark 方案即可）。</li>
              <li>左側「Authentication」→ 開始使用 →「登入方式」啟用 <b>電子郵件/密碼</b>。</li>
              <li>左側「Firestore Database」→ 建立資料庫（選離你近的區域，例如 asia-east1），用「正式版模式」。</li>
              <li>Firestore「規則」分頁貼上 README 裡的安全規則並發布（只允許本人讀寫自己的資料）。</li>
              <li>專案設定（齒輪）→「你的應用程式」→ 新增「網頁應用程式」→ 複製 <code>firebaseConfig</code> 那段貼到下面。</li>
              <li>電腦與手機都貼上同一份設定，並用同一組 Email 登入。</li>
            </ol>
          )}
          <textarea rows={6} placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  ...\n};'} value={cfg} onChange={(e) => setCfg(e.target.value)} />
          <div className="row gap wrap">
            <button className="btn" onClick={saveCfg}>儲存並啟用</button>
            <button className="btn ghost" onClick={() => { setCfg(DEFAULT_FIREBASE_CONFIG); store.update((st) => ({ ...st, settings: { ...st.settings, firebaseConfig: DEFAULT_FIREBASE_CONFIG, firebaseOptOut: false } })); initSync(); }}>使用內建設定</button>
          </div>
        </>
      ) : sync.status === 'signed-out' ? (
        <div className="login">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input type="password" placeholder="密碼（至少 6 字元）" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          <div className="row gap wrap">
            <button className="btn" disabled={busy} onClick={() => doLogin(false)}>登入</button>
            <button className="btn ghost" disabled={busy} onClick={() => doLogin(true)}>註冊新帳號</button>
            <button className="link" onClick={() => resetPassword(email).then(() => toast('已寄出重設密碼信')).catch((e) => toast(e.message, 'err'))}>忘記密碼</button>
          </div>
          <button className="link small" onClick={() => { setCfg(''); store.update((st) => ({ ...st, settings: { ...st.settings, firebaseConfig: '', firebaseOptOut: true } })); initSync(); }}>關閉雲端同步</button>
        </div>
      ) : (
        <div>
          <p>已登入：<b>{sync.email}</b>　{sync.lastSync && <span className="muted small">最後同步 {new Date(sync.lastSync).toLocaleTimeString('zh-TW')}</span>}</p>
          <p className="muted small">任何變更會在 1~2 秒內上傳；另一台裝置開著時會即時收到更新。兩台同時離線修改時，以最後修改的為準。</p>
          <div className="row gap wrap">
            <button className="btn sm ghost" onClick={() => confirm('用本機資料覆蓋雲端？') && forceUpload().then(() => toast('已上傳'))}>以本機覆蓋雲端</button>
            <button className="btn sm ghost" onClick={() => confirm('用雲端資料覆蓋本機？') && forceDownload().then(() => toast('已下載'))}>以雲端覆蓋本機</button>
            <button className="btn sm ghost" onClick={logout}>登出</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupCard() {
  const { toast } = useUi();
  const [text, setText] = useState('');
  const exportData = async () => {
    const json = JSON.stringify({ ...store.get(), settings: { ...store.get().settings, firebaseConfig: '' } });
    setText(json);
    try { await navigator.clipboard.writeText(json); toast('已複製到剪貼簿'); } catch { toast('已顯示在下方，請手動複製', 'info'); }
    if (platform() !== 'android') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `stocksim-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };
  const importData = () => {
    try {
      const d = JSON.parse(text) as AppState;
      if (!d.account || !d.settings) throw new Error();
      if (!confirm('匯入會覆蓋目前所有資料，確定？')) return;
      store.update(() => ({ ...d, settings: { ...d.settings, firebaseConfig: store.get().settings.firebaseConfig } }));
      toast('匯入完成');
    } catch { toast('內容不是有效的備份資料', 'err'); }
  };
  return (
    <div className="card">
      <div className="card-title">備份 / 還原（不使用雲端時可手動搬資料）</div>
      <div className="row gap wrap">
        <button className="btn sm" onClick={exportData}>匯出備份</button>
        <button className="btn sm ghost" disabled={!text} onClick={importData}>從下方文字匯入</button>
      </div>
      <textarea rows={3} placeholder="匯出的 JSON 會出現在這裡；或貼上備份內容後按「匯入」" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

function UpdateCard() {
  const u = useUpdate();
  const p = platform();
  const label: Record<string, string> = {
    idle: '尚未檢查', dev: '開發模式（不檢查更新）', checking: '檢查中…', latest: '已是最新版本',
    available: `有新版本 v${u.version}`, downloading: `下載中 ${u.percent ?? 0}%`, ready: `v${u.version} 已下載，等待安裝`,
    'need-permission': '需要允許安裝權限', error: '檢查失敗',
  };
  return (
    <div className="card">
      <div className="card-title">版本與更新</div>
      <div className="kv">
        <span>目前版本</span><b>v{u.current}</b>
        <span>更新狀態</span><b>{label[u.status]}</b>
      </div>
      {u.error && <div className="note warn">{u.error}</div>}
      {u.notes && (u.status === 'available' || u.status === 'ready' || u.status === 'downloading') && <pre className="notes">{u.notes}</pre>}
      <p className="muted small">
        {p === 'electron' ? '程式啟動時與每 4 小時會自動檢查，新版會在背景下載，關閉程式時自動安裝。'
          : p === 'android' ? '開啟 App 時會自動檢查並下載新版，下載完成後會跳出系統安裝畫面，按「更新」即可（資料會保留）。'
          : '瀏覽器開發模式不會自動更新。'}
      </p>
      <div className="row gap wrap">
        {p !== 'web' && <button className="btn sm" disabled={u.status === 'checking' || u.status === 'downloading'} onClick={() => checkNow(true)}>檢查更新</button>}
        {u.status === 'available' && p === 'android' && <button className="btn sm" onClick={downloadApk}>下載並安裝</button>}
        {u.status === 'ready' && <button className="btn sm" onClick={installNow}>{p === 'electron' ? '立即重新啟動並更新' : '安裝更新'}</button>}
        <a className="btn sm ghost" href={RELEASES_URL} target="_blank" rel="noreferrer">所有版本</a>
      </div>
    </div>
  );
}
