import { useEffect } from 'react';
import { UpdateBanner } from './components/UpdateBanner';
import { go, UiProvider, useRoute, useUi } from './components/ui';
import { fmtNum, fmtPrice } from './lib/format';
import { loadTwData } from './lib/names';
import { checkOrders, refreshPortfolio } from './lib/portfolio';
import { useApp } from './lib/store';
import { initSync, useSync } from './lib/sync';
import { LearnPage } from './pages/Learn';
import { MarketPage } from './pages/Market';
import { SectorsPage } from './pages/Sectors';
import { CompanyPage } from './pages/Company';
import { PortfolioPage } from './pages/Portfolio';
import { ReplayPage } from './pages/Replay';
import { SettingsPage } from './pages/Settings';
import { StockPage } from './pages/Stock';

const NAV = [
  { page: 'market', label: '市場', icon: '📈' },
  { page: 'sectors', label: '板塊', icon: '🧭' },
  { page: 'portfolio', label: '帳戶', icon: '💼' },
  { page: 'replay', label: '回放', icon: '⏪' },
  { page: 'learn', label: '學習', icon: '📘' },
  { page: 'settings', label: '設定', icon: '⚙️' },
];

function Shell() {
  const route = useRoute();
  const app = useApp();
  const sync = useSync();
  const { toast } = useUi();

  useEffect(() => {
    document.documentElement.style.setProperty('--up', app.settings.redUp ? '#f0475a' : '#22b07d');
    document.documentElement.style.setProperty('--down', app.settings.redUp ? '#22b07d' : '#f0475a');
  }, [app.settings.redUp]);

  // 啟動時：雲端同步、台股清單、背景撮合限價單
  useEffect(() => {
    initSync();
    loadTwData();
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const filled = await checkOrders();
      for (const t of filled) toast(`限價單成交：${t.side === 'buy' ? '買進' : '賣出'} ${t.name} ${fmtNum(t.qty)} 股 @ ${fmtPrice(t.price, t.market)}`, 'info');
      refreshPortfolio().catch(() => {});
    };
    const first = setTimeout(tick, 1500);
    const t = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []); // eslint-disable-line

  const active = route.page === 'stock' ? 'market' : route.page === 'company' ? 'sectors' : route.page;
  let body;
  switch (route.page) {
    case 'stock': body = <StockPage key={route.arg} symbol={route.arg || '2330.TW'} />; break;
    case 'sectors': body = <SectorsPage />; break;
    case 'company': body = <CompanyPage key={route.arg} symbol={route.arg || '2330.TW'} />; break;
    case 'portfolio': body = <PortfolioPage />; break;
    case 'replay': body = <ReplayPage key={route.arg || 'home'} id={route.arg} />; break;
    case 'learn': body = <LearnPage />; break;
    case 'settings': body = <SettingsPage />; break;
    default: body = <MarketPage />;
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">股市模擬<span>學習平台</span></div>
        {NAV.map((n) => (
          <button key={n.page} className={active === n.page ? 'on' : ''} onClick={() => go(n.page)}>
            <span className="ni">{n.icon}</span><span className="nl">{n.label}</span>
          </button>
        ))}
        <div className="nav-foot">
          <div>v{__APP_VERSION__}</div>
          {sync.status === 'synced' ? '☁️ 已同步' : sync.status === 'syncing' ? '☁️ 同步中' : sync.status === 'error' ? '⚠️ 同步錯誤' : sync.status === 'signed-out' ? '☁️ 未登入' : '💾 本機儲存'}
        </div>
      </nav>
      <main className="main"><UpdateBanner />{body}</main>
    </div>
  );
}

export default function App() {
  return (
    <UiProvider>
      <Shell />
    </UiProvider>
  );
}
