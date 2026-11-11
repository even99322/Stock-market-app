import { useCallback, useEffect, useMemo, useState } from 'react';
import { PriceChart, type Overlays, type SubKind } from '../components/PriceChart';
import { Readings } from '../components/Readings';
import { TradePanel } from '../components/TradePanel';
import { go, Help, Seg, Spinner, Stat } from '../components/ui';
import { cls, fmtMoney, fmtNum, fmtPct, fmtPrice, fmtTime, fmtVol } from '../lib/format';
import { fetchChart, RANGES } from '../lib/market';
import { getFundamental, loadTwData } from '../lib/names';
import { priceStats } from '../lib/stats';
import { store, useApp } from '../lib/store';
import type { ChartData } from '../lib/types';

const RANGE_KEYS = ['1d', '5d', '1mo', '6mo', '1y', '5y'];

export function StockPage({ symbol }: { symbol: string }) {
  const app = useApp();
  const [range, setRange] = useState(() => localStorage.getItem('stocksim.range') || '6mo');
  const [overlays, setOverlays] = useState<Overlays>({ ma: true, boll: false });
  const [sub, setSub] = useState<SubKind>(() => (localStorage.getItem('stocksim.sub') as SubKind) || 'kd');
  const [chart, setChart] = useState<ChartData | null>(null);
  const [quote, setQuote] = useState<ChartData | null>(null);
  const [daily, setDaily] = useState<ChartData | null>(null);
  const [err, setErr] = useState('');
  const [fundTick, setFundTick] = useState(0);

  const load = useCallback(async (force = false) => {
    setErr('');
    try {
      const [c, q] = await Promise.all([fetchChart(symbol, range, force), fetchChart(symbol, '1d', force)]);
      setChart(c); setQuote(q);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }, [symbol, range]);

  useEffect(() => { setChart(null); load(); }, [load]);
  useEffect(() => {
    setDaily(null);
    fetchChart(symbol, '1y').then(setDaily).catch(() => {});
    if (/\.(TW|TWO)$/.test(symbol)) loadTwData().then(() => setFundTick((x) => x + 1));
  }, [symbol]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchChart(symbol, '1d', true).then(setQuote).catch(() => {});
      if (range === '1d' || range === '5d') fetchChart(symbol, range, true).then(setChart).catch(() => {});
    }, app.settings.refreshSec * 1000);
    return () => clearInterval(t);
  }, [symbol, range, app.settings.refreshSec]);
  useEffect(() => { localStorage.setItem('stocksim.range', range); }, [range]);
  useEffect(() => { localStorage.setItem('stocksim.sub', sub); }, [sub]);

  const stats = useMemo(() => (daily ? priceStats(daily.bars) : null), [daily]);
  const fund = useMemo(() => getFundamental(quote?.symbol || symbol), [quote, symbol, fundTick]);
  const trades = useMemo(() => app.account.trades.filter((t) => t.symbol === (quote?.symbol || symbol)), [app.account.trades, quote, symbol]);
  const inWatch = app.watchlist.includes(symbol);
  const toggleWatch = () =>
    store.update((s) => ({ ...s, watchlist: inWatch ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol] }));

  if (err) {
    return (
      <div className="page">
        <button className="btn sm" onClick={() => history.back()}>← 返回</button>
        <div className="card err">無法取得「{symbol}」：{err}</div>
      </div>
    );
  }
  if (!chart || !quote) return <div className="page center"><Spinner /></div>;

  const sym = quote.symbol;
  const change = quote.price - quote.prevClose;
  const pct = quote.prevClose ? change / quote.prevClose : 0;
  const today = quote.bars;
  const dayHigh = today.length ? Math.max(...today.map((b) => b.high)) : undefined;
  const dayLow = today.length ? Math.min(...today.map((b) => b.low)) : undefined;
  const dayVol = today.reduce((a, b) => a + b.volume, 0);
  const pos = app.account.positions[sym];
  const mk = quote.market;
  const cur = quote.currency;

  return (
    <div className="page">
      <div className="stock-head">
        <button className="icon-btn" onClick={() => (history.length > 1 ? history.back() : go('market'))}>←</button>
        <div className="grow">
          <h2>{quote.name} <span className="muted small">{sym}</span></h2>
          <div className="muted small">
            {quote.exchangeName} · {quote.isOpen ? <span className="up-ish">交易中</span> : '已收盤'}
            {quote.demo && <span className="badge warn">示範資料</span>}
          </div>
        </div>
        {!symbol.startsWith('^') && <button className="btn sm ghost" onClick={() => go('company', sym)}>📊 公司・財報</button>}
        <button className={`icon-btn star ${inWatch ? 'on' : ''}`} onClick={toggleWatch} title="加入自選">{inWatch ? '★' : '☆'}</button>
      </div>
      <div className="price-line">
        <span className={`price ${cls(change)}`}>{fmtPrice(quote.price, mk)}</span>
        <span className={cls(change)}>{change > 0 ? '▲' : change < 0 ? '▼' : ''}{fmtPrice(Math.abs(change), mk)} ({fmtPct(pct)})</span>
        <Help id="change" />
      </div>

      {quote.tradable && (
        <button className="fab" onClick={() => document.getElementById('trade-panel')?.scrollIntoView({ behavior: 'smooth' })}>下單</button>
      )}
      <div className="stock-grid">
        <div className="stock-main">
          <div className="card chart-card">
            <div className="chart-tools">
              <Seg small value={range} onChange={setRange} options={RANGE_KEYS.map((k) => ({ v: k, label: RANGES[k].label }))} />
              <div className="row gap">
                <label className="chk"><input type="checkbox" checked={overlays.ma} onChange={(e) => setOverlays({ ...overlays, ma: e.target.checked })} />均線<Help id="ma" /></label>
                <label className="chk"><input type="checkbox" checked={overlays.boll} onChange={(e) => setOverlays({ ...overlays, boll: e.target.checked })} />布林<Help id="boll" /></label>
                <select value={sub} onChange={(e) => setSub(e.target.value as SubKind)}>
                  <option value="none">副圖：無</option>
                  <option value="kd">KD</option>
                  <option value="rsi">RSI</option>
                  <option value="macd">MACD</option>
                  <option value="obv">OBV</option>
                </select>
                {sub !== 'none' && <Help id={sub} />}
                <Help id="candle" />
              </div>
            </div>
            <PriceChart
              bars={chart.bars} intraday={chart.intraday} gmtoffset={chart.gmtoffset} market={mk}
              overlays={overlays} sub={sub} redUp={app.settings.redUp} trades={trades}
            />
          </div>

          <div className="card">
            <div className="card-title">今日與一年數據</div>
            <div className="stats">
              <Stat label="昨收" value={fmtPrice(quote.prevClose, mk)} />
              <Stat label="開盤" value={fmtPrice(today[0]?.open, mk)} />
              <Stat label="最高" value={fmtPrice(dayHigh, mk)} />
              <Stat label="最低" value={fmtPrice(dayLow, mk)} />
              <Stat label="成交量" value={fmtVol(dayVol, mk)} help="volume" />
              <Stat label="20日均量" value={stats ? fmtVol(stats.avgVol20, mk) : '—'} help="volume" />
              <Stat label="52週高" value={fmtPrice(quote.high52 ?? daily?.high52, mk)} help="w52" />
              <Stat label="52週低" value={fmtPrice(quote.low52 ?? daily?.low52, mk)} help="w52" />
              <Stat label="一年報酬" value={fmtPct(stats?.periodReturn)} className={cls(stats?.periodReturn)} help="return" />
              <Stat label="年化波動" value={fmtPct(stats?.annVol, false, 1)} help="vol" />
              <Stat label="最大回撤" value={fmtPct(stats?.mdd)} className="down" help="mdd" />
              <Stat label="夏普值" value={stats ? stats.sharpe.toFixed(2) : '—'} help="sharpe" />
              <Stat label="上漲天數" value={fmtPct(stats?.upDays, false, 0)} />
              <Stat label="單日最大漲/跌" value={stats ? `${fmtPct(stats.bestDay)} / ${fmtPct(stats.worstDay)}` : '—'} />
              {mk === 'TW' && !sym.startsWith('^') && (
                <>
                  <Stat label="本益比" value={fund?.pe?.toFixed(2) ?? '—'} help="pe" />
                  <Stat label="殖利率" value={fund?.dividendYield != null ? fund.dividendYield.toFixed(2) + '%' : '—'} help="yield" />
                  <Stat label="股價淨值比" value={fund?.pb?.toFixed(2) ?? '—'} help="pb" />
                </>
              )}
            </div>
          </div>

          {daily && <Readings bars={daily.bars} market={mk} />}
        </div>

        <div className="stock-side">
          {quote.tradable ? (
            <div id="trade-panel"><TradePanel symbol={sym} name={quote.name} market={mk} price={quote.price} isOpen={quote.isOpen} demo={quote.demo} /></div>
          ) : (
            <div className="card muted">指數無法直接交易。想買整個市場可以搜尋 0050（台灣 50）或 SPY / VOO（S&P 500 ETF）。</div>
          )}
          {pos && (
            <div className="card">
              <div className="card-title">我的持股 <Help id="avgcost" /></div>
              <div className="kv">
                <span>股數</span><b>{fmtNum(pos.qty)} 股{mk === 'TW' && pos.qty >= 1000 ? `（${fmtNum(pos.qty / 1000, pos.qty % 1000 ? 3 : 0)} 張）` : ''}</b>
                <span>平均成本</span><b>{fmtPrice(pos.avgCost, mk)}</b>
                <span>市值</span><b>{fmtMoney(pos.qty * quote.price, cur)}</b>
                <span>未實現損益</span>
                <b className={cls(quote.price - pos.avgCost)}>
                  {fmtMoney((quote.price - pos.avgCost) * pos.qty, cur, true)} ({fmtPct(quote.price / pos.avgCost - 1)})
                </b>
              </div>
            </div>
          )}
          {trades.length > 0 && (
            <div className="card">
              <div className="card-title">此股交易紀錄</div>
              <div className="mini-list">
                {trades.slice(0, 10).map((t) => (
                  <div key={t.id} className="mini-row">
                    <span className={t.side === 'buy' ? 'tag buy' : 'tag sell'}>{t.side === 'buy' ? '買' : '賣'}</span>
                    <span>{fmtNum(t.qty)} 股 @ {fmtPrice(t.price, mk)}</span>
                    <span className="muted small">{fmtTime(t.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
