import { useEffect, useMemo, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { go, Help, Seg, Stat, useUi } from '../components/ui';
import { availableCash, cancelOrder, exchangeFx, newAccount } from '../lib/engine';
import { cls, fmtMoney, fmtNum, fmtPct, fmtPrice, fmtTime } from '../lib/format';
import { computeTotals, live, refreshPortfolio } from '../lib/portfolio';
import { store, useApp } from '../lib/store';
import type { Currency } from '../lib/types';

export function PortfolioPage() {
  const app = useApp();
  const { toast } = useUi();
  const acc = app.account;
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<'pos' | 'orders' | 'trades' | 'fx'>('pos');

  useEffect(() => {
    refreshPortfolio(true).then(() => setTick((x) => x + 1));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshPortfolio(true).then(() => setTick((x) => x + 1));
    }, app.settings.refreshSec * 1000);
    return () => clearInterval(t);
  }, [app.settings.refreshSec]);

  const totals = useMemo(() => computeTotals(acc, live.quotes, live.rate), [acc, tick]);
  const pnl = totals.totalTwd - totals.initialTwd;
  const sells = acc.trades.filter((t) => t.side === 'sell');
  const wins = sells.filter((t) => (t.realized ?? 0) > 0).length;
  const costs = { TWD: 0, USD: 0 } as Record<Currency, number>;
  for (const t of acc.trades) costs[t.market === 'TW' ? 'TWD' : 'USD'] += t.fee + t.tax;
  const positions = Object.values(acc.positions);
  const equitySeries = useMemo(
    () => [{ name: '總資產(NT$)', color: '#4ea1ff', area: true, data: acc.equityLog }],
    [acc.equityLog],
  );

  const reset = () => {
    if (!confirm('確定要重置模擬帳戶？所有持股、掛單與交易紀錄都會清除（回放紀錄保留）。')) return;
    store.update((s) => ({ ...s, account: newAccount(s.settings) }));
    toast('帳戶已重置');
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>我的帳戶</h2>
        <button className="btn sm ghost" onClick={reset}>重置帳戶</button>
      </div>

      <div className="card hero">
        <div className="muted small">總資產（換算台幣）</div>
        <div className="hero-num">{fmtMoney(totals.totalTwd, 'TWD')}</div>
        <div className={cls(pnl)}>
          總損益 {fmtMoney(pnl, 'TWD', true)}（{fmtPct(pnl / totals.initialTwd)}）
        </div>
        <div className="muted small">
          USD/TWD 匯率 {totals.rate.toFixed(3)}{live.rateDemo ? '（離線預設值）' : ''} <Help id="fx" />
        </div>
      </div>

      <div className="two-col">
        {(['TWD', 'USD'] as Currency[]).map((c) => {
          const t = totals.byCur[c];
          return (
            <div key={c} className="card">
              <div className="card-title">{c === 'TWD' ? '台幣帳戶（台股）' : '美元帳戶（美股）'}</div>
              <div className="stats">
                <Stat label="現金" value={fmtMoney(t.cash, c)} />
                <Stat label="可用（扣掛單）" value={fmtMoney(availableCash(acc, c, app.settings), c)} />
                <Stat label="股票市值" value={fmtMoney(t.mv, c)} />
                <Stat label="未實現損益" value={fmtMoney(t.unreal, c, true)} className={cls(t.unreal)} help="avgcost" />
                <Stat label="已實現損益" value={fmtMoney(acc.realized[c], c, true)} className={cls(acc.realized[c])} />
                <Stat label="累計手續費+稅" value={fmtMoney(costs[c], c)} help="fees" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">資產曲線 <span className="muted small">（每天開啟程式時記錄）</span></div>
        {acc.equityLog.length >= 2 ? <LineChart series={equitySeries} /> : <div className="muted pad">累積兩天以上的紀錄後會顯示曲線。</div>}
        <div className="stats">
          <Stat label="賣出次數" value={fmtNum(sells.length)} />
          <Stat label="勝率" value={sells.length ? fmtPct(wins / sells.length, false, 0) : '—'} />
          <Stat label="持股檔數" value={fmtNum(positions.length)} />
          <Stat label="開戶日" value={new Date(acc.createdAt).toLocaleDateString('zh-TW')} />
        </div>
      </div>

      <div className="card">
        <Seg value={tab} onChange={setTab} options={[
          { v: 'pos', label: `持股 ${positions.length}` },
          { v: 'orders', label: `掛單 ${acc.orders.length}` },
          { v: 'trades', label: '交易紀錄' },
          { v: 'fx', label: '換匯' },
        ]} />
        {tab === 'pos' && (
          <div className="table">
            <div className="tr th"><div>名稱</div><div className="num">股數 / 均價</div><div className="num">現價</div><div className="num">損益</div></div>
            {positions.map((p) => {
              const q = live.quotes[p.symbol];
              const price = q?.price ?? p.avgCost;
              const u = (price - p.avgCost) * p.qty;
              return (
                <div key={p.symbol} className="tr" onClick={() => go('stock', p.symbol)}>
                  <div className="name"><b>{p.name}</b><span className="muted small">{p.symbol}</span></div>
                  <div className="num">{fmtNum(p.qty)}<div className="muted small">{fmtPrice(p.avgCost, p.market)}</div></div>
                  <div className={`num ${q ? cls(q.change) : ''}`}>{fmtPrice(price, p.market)}</div>
                  <div className={`num ${cls(u)}`}>{fmtMoney(u, p.currency, true)}<div className="small">{fmtPct(price / p.avgCost - 1)}</div></div>
                </div>
              );
            })}
            {!positions.length && <div className="muted pad">目前沒有持股。到「市場」找一檔股票試著買進吧！</div>}
          </div>
        )}
        {tab === 'orders' && (
          <div className="table">
            {acc.orders.map((o) => (
              <div key={o.id} className="tr">
                <div className="name"><b>{o.name}</b><span className="muted small">{fmtTime(o.createdAt)}</span></div>
                <div className="num"><span className={`tag ${o.side}`}>{o.side === 'buy' ? '限價買' : '限價賣'}</span></div>
                <div className="num">{fmtNum(o.qty)} 股 @ {fmtPrice(o.limit, o.market)}</div>
                <div className="num"><button className="btn sm" onClick={() => store.update((s) => ({ ...s, account: cancelOrder(s.account, o.id) }))}>取消</button></div>
              </div>
            ))}
            {!acc.orders.length && <div className="muted pad">沒有掛單。限價單會在價格觸及時自動成交 <Help id="order" /></div>}
          </div>
        )}
        {tab === 'trades' && (
          <div className="table">
            {acc.trades.slice(0, 200).map((t) => (
              <div key={t.id} className="tr" onClick={() => go('stock', t.symbol)}>
                <div className="name"><b>{t.name}</b><span className="muted small">{fmtTime(t.time)}{t.note ? ` · ${t.note}` : ''}</span></div>
                <div className="num"><span className={`tag ${t.side}`}>{t.side === 'buy' ? '買' : '賣'}</span> {fmtNum(t.qty)} 股</div>
                <div className="num">@ {fmtPrice(t.price, t.market)}<div className="muted small">費 {fmtNum(t.fee + t.tax, t.market === 'US' ? 2 : 0)}</div></div>
                <div className={`num ${cls(t.realized)}`}>{t.realized != null ? fmtMoney(t.realized, t.market === 'TW' ? 'TWD' : 'USD', true) : ''}</div>
              </div>
            ))}
            {!acc.trades.length && <div className="muted pad">還沒有交易。</div>}
          </div>
        )}
        {tab === 'fx' && <FxPanel />}
      </div>
    </div>
  );
}

function FxPanel() {
  const app = useApp();
  const { toast } = useUi();
  const [from, setFrom] = useState<Currency>('TWD');
  const [amt, setAmt] = useState('');
  const a = parseFloat(amt) || 0;
  const rate = live.rate;
  const out = from === 'TWD' ? a / rate : a * rate;
  const go2 = () => {
    try {
      const next = exchangeFx(app.account, from, a, rate, app.settings);
      store.update((s) => ({ ...s, account: next }));
      toast(`換匯完成：${fmtMoney(a, from)} → ${fmtMoney(out, from === 'TWD' ? 'USD' : 'TWD')}`);
      setAmt('');
    } catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <div className="fx">
      <p className="muted small">買美股需要美元。依目前匯率 1 USD = {rate.toFixed(3)} TWD 換匯（不計價差）。<Help id="fx" /></p>
      <Seg small value={from} onChange={setFrom} options={[{ v: 'TWD', label: '台幣 → 美元' }, { v: 'USD', label: '美元 → 台幣' }]} />
      <label className="field"><span>換出金額（{from}）</span>
        <input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </label>
      <div className="kv"><span>可得</span><b>{fmtMoney(out, from === 'TWD' ? 'USD' : 'TWD')}</b></div>
      <button className="btn block" disabled={a <= 0} onClick={go2}>確認換匯</button>
      <div className="mini-list">
        {app.account.fx.slice(0, 10).map((f) => (
          <div key={f.id} className="mini-row">
            <span>{fmtMoney(f.fromAmount, f.from)} → {fmtMoney(f.toAmount, f.to)}</span>
            <span className="muted small">@{f.rate.toFixed(3)} · {fmtTime(f.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
