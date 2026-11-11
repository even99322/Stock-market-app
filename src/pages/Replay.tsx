import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { PriceChart, type SubKind } from '../components/PriceChart';
import { Readings } from '../components/Readings';
import { SymbolSearch } from '../components/SymbolSearch';
import { go, Help, Seg, Spinner, Stat, useUi } from '../components/ui';
import { calcFees } from '../lib/fees';
import { maxBuyQty, replayTrade, uid } from '../lib/engine';
import { cls, dateStr, fmtMoney, fmtNum, fmtPct, fmtPrice } from '../lib/format';
import { fetchChart } from '../lib/market';
import { BUILTIN, type SymbolInfo } from '../lib/names';
import { maxDrawdown } from '../lib/stats';
import { store, useApp } from '../lib/store';
import type { ChartData, ReplaySession, Side } from '../lib/types';

const MIN_HISTORY = 60;

export function ReplayPage({ id }: { id?: string }) {
  return id ? <SessionView id={id} /> : <ReplayHome />;
}

function ReplayHome() {
  const app = useApp();
  const { toast, help } = useUi();
  const [pick, setPick] = useState<SymbolInfo | null>(null);
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [cash, setCash] = useState('');
  const [blind, setBlind] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async (sym: SymbolInfo, startDate: string | null, isBlind: boolean, initCash?: number) => {
    setBusy(true);
    try {
      const data = await fetchChart(sym.symbol, '10y');
      const bars = data.bars;
      if (bars.length < MIN_HISTORY + 40) throw new Error('歷史資料太短，換一檔試試');
      let idx: number;
      if (startDate) {
        idx = bars.findIndex((b) => dateStr(b.time, data.gmtoffset) >= startDate);
        const minD = dateStr(bars[MIN_HISTORY].time, data.gmtoffset);
        const maxD = dateStr(bars[bars.length - 21].time, data.gmtoffset);
        if (idx < MIN_HISTORY || idx > bars.length - 21) throw new Error(`起始日需介於 ${minD} 與 ${maxD} 之間`);
      } else {
        idx = MIN_HISTORY + Math.floor(Math.random() * (bars.length - MIN_HISTORY - 130));
      }
      const c = initCash ?? (data.market === 'TW' ? 1_000_000 : 30_000);
      const d0 = dateStr(bars[idx].time, data.gmtoffset);
      const sess: ReplaySession = {
        id: uid(), symbol: data.symbol, name: data.name, market: data.market, currency: data.currency,
        startDate: d0, curDate: d0, initialCash: c, cash: c, qty: 0, avgCost: 0, realized: 0,
        trades: [], equity: [{ d: d0, v: c }], blind: isBlind, finished: false, createdAt: Date.now(),
      };
      store.update((s) => ({ ...s, replays: [sess, ...s.replays].slice(0, 30) }));
      if (data.demo) toast('目前離線，使用示範資料進行回放', 'info');
      go('replay', sess.id);
    } catch (e: any) {
      toast(e.message || String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const random = () => {
    const pool = BUILTIN.filter((x) => x.kind !== 'index');
    const s = pool[Math.floor(Math.random() * pool.length)];
    create(s, null, true);
  };

  return (
    <div className="page">
      <div className="page-head"><h2>歷史回放練習</h2><button className="btn sm ghost" onClick={() => help('replay')}>怎麼玩？</button></div>
      <div className="card">
        <div className="card-title">開始新的回放</div>
        <p className="muted small">回到過去某一天，只看得到那天以前的 K 線，一天一天往前推進並練習買賣，最後和「買進持有」比較。</p>
        {pick ? (
          <div className="picked">
            <span className={`tag ${pick.market}`}>{pick.market === 'TW' ? '台' : '美'}</span>
            <b>{pick.name}</b> <span className="muted">{pick.symbol}</span>
            <button className="btn sm ghost" onClick={() => setPick(null)}>更換</button>
          </div>
        ) : (
          <SymbolSearch excludeIndex onPick={setPick} placeholder="選擇要練習的股票：2330、0050、AAPL…" />
        )}
        <div className="form-grid">
          <label className="field"><span>起始日期</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span>初始資金（{pick?.market === 'US' ? 'USD' : 'TWD'}）</span>
            <input type="number" inputMode="numeric" placeholder={pick?.market === 'US' ? '30000' : '1000000'} value={cash} onChange={(e) => setCash(e.target.value)} />
          </label>
        </div>
        <label className="chk"><input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />盲測模式（隱藏股票名稱與日期）</label>
        <div className="row gap wrap">
          <button className="btn" disabled={!pick || busy} onClick={() => pick && create(pick, start, blind, parseFloat(cash) || undefined)}>
            {busy ? '載入中…' : '開始回放'}
          </button>
          <button className="btn ghost" disabled={busy} onClick={random}>🎲 隨機盲測挑戰</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">我的回放紀錄</div>
        <div className="table">
          {app.replays.map((r) => {
            const last = r.equity[r.equity.length - 1]?.v ?? r.initialCash;
            const ret = last / r.initialCash - 1;
            return (
              <div key={r.id} className="tr" onClick={() => go('replay', r.id)}>
                <div className="name">
                  <b>{r.blind && !r.finished ? '神秘股票' : r.name}</b>
                  <span className="muted small">{r.blind && !r.finished ? `已進行 ${r.equity.length} 天` : `${r.startDate} → ${r.curDate}`}</span>
                </div>
                <div className="num">{r.finished ? <span className="tag">已結束</span> : <span className="tag buy">進行中</span>}</div>
                <div className={`num ${cls(ret)}`}>{fmtPct(ret)}</div>
                <div className="ops" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" title="刪除" onClick={() => confirm('刪除這筆回放？') && store.update((s) => ({ ...s, replays: s.replays.filter((x) => x.id !== r.id) }))}>✕</button>
                </div>
              </div>
            );
          })}
          {!app.replays.length && <div className="muted pad">還沒有回放紀錄。</div>}
        </div>
      </div>
    </div>
  );
}

function SessionView({ id }: { id: string }) {
  const app = useApp();
  const { toast } = useUi();
  const sess = app.replays.find((r) => r.id === id);
  const [data, setData] = useState<ChartData | null>(null);
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [side, setSide] = useState<Side>('buy');
  const [unit, setUnit] = useState<'lot' | 'share'>('lot');
  const [qtyText, setQtyText] = useState('1');
  const [sub, setSub] = useState<SubKind>('kd');
  const [ma, setMa] = useState(true);

  useEffect(() => {
    if (!sess) return;
    fetchChart(sess.symbol, '10y').then(setData).catch((e) => setErr(e.message));
    setUnit(sess.market === 'TW' ? 'lot' : 'share');
  }, [sess?.symbol]); // eslint-disable-line

  const curIdx = useMemo(() => {
    if (!data || !sess) return -1;
    let i = -1;
    for (let k = 0; k < data.bars.length; k++) if (dateStr(data.bars[k].time, data.gmtoffset) <= sess.curDate) i = k;
    return i;
  }, [data, sess?.curDate]); // eslint-disable-line
  const startIdx = useMemo(() => (data && sess ? data.bars.findIndex((b) => dateStr(b.time, data.gmtoffset) >= sess.startDate) : -1), [data, sess?.startDate]); // eslint-disable-line

  const update = (fn: (r: ReplaySession) => ReplaySession) =>
    store.update((s) => ({ ...s, replays: s.replays.map((r) => (r.id === id ? fn(r) : r)) }));

  const step = (n: number) => {
    if (!data) return;
    update((r) => {
      if (r.finished) return r;
      let i = curIdx;
      const eq = [...r.equity];
      let d = r.curDate;
      for (let k = 0; k < n && i < data.bars.length - 1; k++) {
        i++;
        d = dateStr(data.bars[i].time, data.gmtoffset);
        eq.push({ d, v: Math.round((r.cash + r.qty * data.bars[i].close) * 100) / 100 });
      }
      const finished = i >= data.bars.length - 1;
      if (finished) setPlaying(false);
      return { ...r, curDate: d, equity: eq, finished };
    });
  };

  // 自動播放
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => stepRef.current(1), speed);
    return () => clearInterval(t);
  }, [playing, speed]);

  if (!sess) return <div className="page"><div className="card">找不到這筆回放。<button className="btn sm" onClick={() => go('replay')}>回列表</button></div></div>;
  if (err) return <div className="page"><div className="card err">{err}</div></div>;
  if (!data || curIdx < 0) return <div className="page center"><Spinner /></div>;

  const bars = data.bars.slice(0, curIdx + 1);
  const bar = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const price = bar.close;
  const mk = sess.market;
  const cur = sess.currency;
  const hide = sess.blind && !sess.finished;
  const equity = sess.cash + sess.qty * price;
  const ret = equity / sess.initialCash - 1;
  const s = app.settings;
  const startClose = data.bars[startIdx]?.close ?? price;
  const bhQty = maxBuyQty(sess.initialCash, startClose, mk, sess.symbol, s);
  const bhCash = sess.initialCash - calcFees(mk, sess.symbol, 'buy', bhQty, startClose, s).net;
  const bhValue = bhCash + bhQty * price;
  const bhRet = bhValue / sess.initialCash - 1;
  const lot = mk === 'TW' && unit === 'lot' ? 1000 : 1;
  const qty = Math.round((parseFloat(qtyText) || 0) * lot);
  const fee = calcFees(mk, sess.symbol, side, qty, price, s);
  const dayN = curIdx - startIdx + 1;

  const trade = (sd: Side, q: number) => {
    try {
      update((r) => replayTrade(r, sd, q, price, bar.time * 1000, s));
      toast(`${sd === 'buy' ? '買進' : '賣出'} ${fmtNum(q)} 股 @ ${fmtPrice(price, mk)}`);
    } catch (e: any) { toast(e.message, 'err'); }
  };
  const setMax = () => {
    if (side === 'buy') setQtyText(String(maxBuyQty(sess.cash, price, mk, sess.symbol, s, lot) / lot));
    else setQtyText(String(Math.floor(sess.qty / lot)));
  };

  return (
    <div className="page">
      <div className="stock-head">
        <button className="icon-btn" onClick={() => { setPlaying(false); go('replay'); }}>←</button>
        <div className="grow">
          <h2>{hide ? '神秘股票' : sess.name} {!hide && <span className="muted small">{sess.symbol}</span>}</h2>
          <div className="muted small">
            {hide ? `第 ${dayN} 個交易日` : `${dateStr(bar.time, data.gmtoffset)}（第 ${dayN} 個交易日）`}
            {data.demo && <span className="badge warn">示範資料</span>}
            {sess.finished && <span className="badge">已結束</span>}
          </div>
        </div>
      </div>
      <div className="price-line">
        <span className={`price ${cls(price - (prev?.close ?? price))}`}>{fmtPrice(price, mk)}</span>
        {prev && <span className={cls(price - prev.close)}>{fmtPct(price / prev.close - 1)}</span>}
      </div>

      {sess.finished && <Summary sess={sess} data={data} startIdx={startIdx} bhRet={bhRet} />}

      <div className="stock-grid">
        <div className="stock-main">
          <div className="card chart-card">
            <div className="chart-tools">
              <div className="row gap">
                <label className="chk"><input type="checkbox" checked={ma} onChange={(e) => setMa(e.target.checked)} />均線</label>
                <select value={sub} onChange={(e) => setSub(e.target.value as SubKind)}>
                  <option value="none">副圖：無</option><option value="kd">KD</option><option value="rsi">RSI</option>
                  <option value="macd">MACD</option><option value="obv">OBV</option>
                </select>
              </div>
            </div>
            <PriceChart
              bars={bars} intraday={false} gmtoffset={data.gmtoffset} market={mk}
              overlays={{ ma, boll: false }} sub={sub} redUp={s.redUp} trades={sess.trades}
              visibleBars={140} hideDates={hide} height={340}
            />
          </div>
          {!sess.finished && (
            <div className="card controls">
              <button className="btn" onClick={() => step(1)}>下一天 ▶</button>
              <button className="btn ghost" onClick={() => step(5)}>+5 天</button>
              <button className="btn ghost" onClick={() => step(20)}>+20 天</button>
              <button className="btn ghost" onClick={() => setPlaying(!playing)}>{playing ? '⏸ 暫停' : '⏵ 自動播放'}</button>
              <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
                <option value={1200}>慢</option><option value={600}>中</option><option value={200}>快</option>
              </select>
              <button className="btn ghost danger" onClick={() => { if (confirm('結束這次回放並查看成績？')) { setPlaying(false); update((r) => ({ ...r, finished: true })); } }}>結束並看成績</button>
            </div>
          )}
          <Readings bars={bars} market={mk} />
        </div>

        <div className="stock-side">
          <div className="card">
            <div className="card-title">回放帳戶</div>
            <div className="stats">
              <Stat label="總資產" value={fmtMoney(equity, cur)} />
              <Stat label="報酬率" value={fmtPct(ret)} className={cls(ret)} help="return" />
              <Stat label="買進持有報酬" value={fmtPct(bhRet)} className={cls(bhRet)} />
              <Stat label="現金" value={fmtMoney(sess.cash, cur)} />
              <Stat label="持股" value={`${fmtNum(sess.qty)} 股`} />
              <Stat label="平均成本" value={sess.qty ? fmtPrice(sess.avgCost, mk) : '—'} help="avgcost" />
            </div>
          </div>
          {!sess.finished && (
            <div className="card trade">
              <div className="card-title">以今日收盤價交易</div>
              <Seg value={side} onChange={setSide} options={[{ v: 'buy', label: '買進' }, { v: 'sell', label: '賣出' }]} />
              {mk === 'TW' && <Seg small value={unit} onChange={(u) => { setUnit(u); setQtyText('1'); }} options={[{ v: 'lot', label: '張' }, { v: 'share', label: '股' }]} />}
              <label className="field">
                <span>數量（{lot === 1000 ? '張' : '股'}）</span>
                <div className="row">
                  <input type="number" inputMode="numeric" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
                  <button className="btn sm" onClick={setMax}>最大</button>
                </div>
              </label>
              <div className="kv small">
                <span>金額</span><b>{fmtMoney(fee.gross, cur)}</b>
                <span>費用+稅 <Help id="fees" /></span><b>{fmtMoney(fee.fee + fee.tax, cur)}</b>
              </div>
              <button className={`btn block ${side}`} disabled={qty <= 0} onClick={() => trade(side, qty)}>{side === 'buy' ? '買進' : '賣出'}</button>
              {sess.qty > 0 && <button className="btn block ghost" onClick={() => trade('sell', sess.qty)}>全部賣出</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ sess, data, startIdx, bhRet }: { sess: ReplaySession; data: ChartData; startIdx: number; bhRet: number }) {
  const s = store.get().settings;
  const final = sess.equity[sess.equity.length - 1]?.v ?? sess.initialCash;
  const ret = final / sess.initialCash - 1;
  const mdd = maxDrawdown(sess.equity.map((e) => e.v)).mdd;
  const sells = sess.trades.filter((t) => t.side === 'sell');
  const wins = sells.filter((t) => (t.realized ?? 0) > 0).length;
  const costs = sess.trades.reduce((a, t) => a + t.fee + t.tax, 0);
  const series = useMemo(() => {
    const startClose = data.bars[startIdx].close;
    const q = maxBuyQty(sess.initialCash, startClose, sess.market, sess.symbol, s);
    const c0 = sess.initialCash - calcFees(sess.market, sess.symbol, 'buy', q, startClose, s).net;
    const bh = data.bars.slice(startIdx).map((b) => ({ d: dateStr(b.time, data.gmtoffset), v: Math.round(c0 + q * b.close) }))
      .filter((x) => x.d <= sess.curDate);
    const bhMdd = maxDrawdown(bh.map((x) => x.v)).mdd;
    return { lines: [
      { name: '我的操作', color: '#4ea1ff', area: true, data: sess.equity },
      { name: '買進持有', color: '#9aa5bb', data: bh },
    ], bhMdd };
  }, [sess, data, startIdx]); // eslint-disable-line
  const beat = ret > bhRet;
  return (
    <div className="card summary">
      <div className="card-title">🏁 回放成績：{sess.name}（{sess.symbol}）{sess.startDate} → {sess.curDate}</div>
      <div className={`verdict ${beat ? 'good' : 'bad'}`}>
        {beat ? `贏過買進持有 ${fmtPct(ret - bhRet)} 🎉` : `輸給買進持有 ${fmtPct(bhRet - ret)}——想想是太早出場、還是交易太頻繁？`}
      </div>
      <div className="stats">
        <Stat label="最終資產" value={fmtMoney(final, sess.currency)} />
        <Stat label="我的報酬" value={fmtPct(ret)} className={cls(ret)} help="return" />
        <Stat label="買進持有報酬" value={fmtPct(bhRet)} className={cls(bhRet)} />
        <Stat label="我的最大回撤" value={fmtPct(mdd)} className="down" help="mdd" />
        <Stat label="持有的最大回撤" value={fmtPct(series.bhMdd)} className="down" />
        <Stat label="交易次數" value={fmtNum(sess.trades.length)} />
        <Stat label="勝率（賣出）" value={sells.length ? fmtPct(wins / sells.length, false, 0) : '—'} />
        <Stat label="手續費+稅" value={fmtMoney(costs, sess.currency)} help="fees" />
      </div>
      <LineChart series={series.lines} />
    </div>
  );
}
