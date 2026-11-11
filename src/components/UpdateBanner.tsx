import { useEffect } from 'react';
import { platform } from '../lib/http';
import { downloadApk, initUpdater, installNow, openInstallPermission, useUpdate } from '../lib/updater';

/** 畫面頂端的更新提示列（只在有新版時出現） */
export function UpdateBanner() {
  const u = useUpdate();
  useEffect(() => { initUpdater(); }, []);
  const p = platform();
  const v = u.version ? `v${u.version}` : '新版本';
  if (u.status === 'downloading') {
    return <div className="upd-banner">⬇️ 正在下載 {v}… {u.percent ?? 0}%<div className="upd-bar"><i style={{ width: `${u.percent ?? 0}%` }} /></div></div>;
  }
  if (u.status === 'ready') {
    return (
      <div className="upd-banner ready">
        <span>✅ {v} 已下載完成{p === 'electron' ? '，關閉程式時會自動安裝' : ''}</span>
        <button className="btn sm" onClick={installNow}>{p === 'electron' ? '立即重新啟動並更新' : '安裝更新'}</button>
      </div>
    );
  }
  if (u.status === 'need-permission') {
    return (
      <div className="upd-banner">
        <span>有新版本 {v}。請先允許本 App「安裝不明應用程式」，返回後按「更新」。</span>
        <div className="row gap">
          <button className="btn sm ghost" onClick={openInstallPermission}>前往允許</button>
          <button className="btn sm" onClick={downloadApk}>更新</button>
        </div>
      </div>
    );
  }
  if (u.status === 'available' && p === 'android') {
    return <div className="upd-banner"><span>有新版本 {v}</span><button className="btn sm" onClick={downloadApk}>下載並安裝</button></div>;
  }
  return null;
}
