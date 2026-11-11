import { useEffect, useState } from 'react';
import { calcFees } from '../lib/fees';
import { availableCash, availableQty, curOf, executeTrade, maxBuyQty, placeLimitOrder } from '../lib/engine';
import { fmtMoney, fmtNum, fmtPct, fmtPrice } from '../lib/format';
import { computeTotals, live, rateFor } from '../lib/portfolio';
import { store, useApp } from '../lib/store';
import type { Market, Side } from '../lib/types';
import { Help, Seg, useUi } from './ui';

interface Props {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  isOpen: boolean;
  demo: boolean;
}
type OrderType = 'market' | 'limit' | 'stop';

export function TradePanel({ symbol, name, market, price, isOpen, demo }: Props) {
  const app = useApp();
  const { toast } = useUi();
  const s = app.settings;
  const acc = app.account;
  const cur = curOf(market);
  const [side, setSideRaw] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [unit, setUnit] = useState<'lot' | 'share'>(market === 'TW' ? 'lot' : 'share');
  const [qtyText, setQtyText] = useState('1');
  const [limitText, setLimitText] = useState('');
  const [stopText, setStopText] = useState('');
  const [riskStop, setRiskStop] = useState('');
  const [autoStop, setAutoStop] = useState(true);

  const setSide = (v: Side) => { setSideRaw(v); if (v === 'buy' && type === 'stop') setType('market'); };
  useEffect(() => {
    setLimitText(price ? String(+price.toFixed(2)) : '');
    setStopText(price ? String(+(price * 0.95).toFixed(2)) : '');
    setRiskStop('');
  }, [symbol]); // eslint-disable-line
  useEffect(() => { setUnit(market === 'TW' ? 'lot' : 'share'); setQtyText('1'); }, [market, symbol]);

  const lot = unit === 'lot' ? 1000 : 1;
  const qty = Math.round((parseFloat(qtyText) || 0) * lot);
  const px = type === 'limit' ? parseFloat(limitText) || 0 : type === 'stop' ? parseFloat(stopText) || 0 : price;
  const f = calcFees(market, symbol, side, qty, px, s);
  const cash = availableCash(acc, cur, s);
  const pos = acc.positions[symbol];
  const held = pos?.qty ?? 0;
  const sellable = availableQty(acc, symbol);

  // ---- 風險試算（買進時）：若在停損價賣出會虧多少、佔總資產多少 ----
  const rs = parseFloat(riskStop) || 0;
  const entry = type === 'limit' ? px : price;
  const totalTwd = computeTotals(acc, live.quotes, live.rate).totalTwd;
  const perShareLoss = rs > 0 && rs < entry
    ? entry - rs + (calcFees(market, symbol, 'buy', qty || lot, entry, s).fee + (() => { const x = calcFees(market, symbol, 'sell', qty || lot, rs, s); return x.fee + x.tax; })()) / (qty || lot)
    : 0;
  const loss = perShareLoss * qty;
  const lossPct = totalTwd > 0 ? (loss * rateFor(cur)) / totalTwd : 0;
  const suggest = (pct: number) => (perShareLoss > 0 ? Math.floor(((totalTwd * pct) / rateFor(cur)) / perShareLoss / lot) : 0);

  const setMax = () => {
    if (side === 'buy') setQtyText(String(maxBuyQty(cash, px, market, symbol, s, lot) / lot));
    else setQtyText(String(Math.floor((type === 'market' ? sellable : held) / lot)));
  };

  const submit = () => {
    try {
      if (demo && type === 'market') {
        if (!confirm('目前是「示範資料」（無法取得真實報價），確定要用示範價格成交嗎？')) return;
      }
      if (type === 'market') {
        let next = executeTrade(acc, { symbol, name, market, side, qty, price, note: isOpen ? undefined : '盤後（以最後成交價）' }, s);
        let extra = '';
        if (side === 'buy' && autoStop && rs > 0 && rs < price) {
          try {
            next = placeLimitOrder(next, { symbol, name, market, side: 'sell', qty, limit: rs, kind: 'stop' }, s);
            extra = `，並掛停損單 @ ${fmtPrice(rs, market)}`;
          } catch { /* 已有停損單佔用股數時略過 */ }
        }
        store.update((st) => ({ ...st, account: next }));
        toast(`${side === 'buy' ? '買進' : '賣出'} ${name} ${fmtNum(qty)} 股 @ ${fmtPrice(price, market)} 成交${extra}`);
      } else if (type === 'stop') {
        if (px >= price) throw new Error('停損價要低於目前價格，否則會立刻觸發');
        const next = placeLimitOrder(acc, { symbol, name, market, side: 'sell', qty, limit: px, kind: 'stop' }, s);
        store.update((st) => ({ ...st, account: next }));
        toast(`已掛停損單 ${fmtNum(qty)} 股：跌到 ${fmtPrice(px, market)} 以下自動賣出`, 'info');
      } else {
        const next = placeLimitOrder(acc, { symbol, name, market, side, qty, limit: px }, s);
        store.update((st) => ({ ...st, account: next }));
        toast(`已掛${side === 'buy' ? '買' : '賣'}單 ${fmtNum(qty)} 股 @ ${fmtPrice(px, market)}，觸價後自動成交`, 'info');
      }
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  const typeOpts: { v: OrderType; label: string }[] = side === 'sell'
    ? [{ v: 'market', label: '市價' }, { v: 'limit', label: '限價(停利)' }, { v: 'stop', label: '停損' }]
    : [{ v: 'market', label: '市價' }, { v: 'limit', label: '限價' }];
  const stopLossAmt = type === 'stop' && pos ? (px - pos.avgCost) * qty : 0;

  return (
    <div className="card trade">
      <div className="card-title">模擬下單 <Help id="order" /></div>
      <Seg value={side} onChange={setSide} options={[{ v: 'buy', label: '買進' }, { v: 'sell', label: '賣出' }]} />
      <div className="row gap wrap">
        <Seg small value={type} onChange={setType} options={typeOpts} />
        {market === 'TW' && (
          <Seg small value={unit} onChange={(u) => { setUnit(u); setQtyText('1'); }} options={[{ v: 'lot', label: '張' }, { v: 'share', label: '股(零股)' }]} />
        )}
        <Help id={type === 'stop' ? 'stoploss' : 'lot'} />
      </div>
      {type === 'limit' && (
        <label className="field">
          <span>限價</span>
          <input type="number" inputMode="decimal" step="0.01" value={limitText} onChange={(e) => setLimitText(e.target.value)} />
        </label>
      )}
      {type === 'stop' && (
        <label className="field">
          <span>停損價（跌到這個價位以下就賣出）<Help id="stoploss" /></span>
          <div className="row">
            <input type="number" inputMode="decimal" step="0.01" value={stopText} onChange={(e) => setStopText(e.target.value)} />
            {[0.03, 0.05, 0.1].map((d) => (
              <button key={d} className="btn sm ghost" onClick={() => setStopText(String(+(price * (1 - d)).toFixed(2)))}>-{d * 100}%</button>
            ))}
          </div>
        </label>
      )}
      <label className="field">
        <span>數量（{unit === 'lot' ? '張' : '股'}）</span>
        <div className="row">
          <button className="btn sm" onClick={() => setQtyText(String(Math.max(0, (parseFloat(qtyText) || 0) - 1)))}>−</button>
          <input type="number" inputMode="numeric" min="0" step="1" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
          <button className="btn sm" onClick={() => setQtyText(String((parseFloat(qtyText) || 0) + 1))}>＋</button>
          <button className="btn sm" onClick={setMax}>最大</button>
        </div>
      </label>
      <div className="kv">
        <span>{type === 'market' ? '參考價' : type === 'stop' ? '停損價' : '限價'}</span><b>{fmtPrice(px, market)}</b>
        <span>成交金額</span><b>{fmtMoney(f.gross, cur)}</b>
        <span>手續費 <Help id="fees" /></span><b>{fmtMoney(f.fee, cur)}</b>
        {market === 'TW' && side === 'sell' && (<><span>證交稅</span><b>{fmtMoney(f.tax, cur)}</b></>)}
        <span>{side === 'buy' ? '預估付出' : '預估入帳'}</span><b className="big">{fmtMoney(f.net, cur)}</b>
        {type === 'stop' && pos && (<><span>觸發時約損益</span><b className={stopLossAmt >= 0 ? 'up' : 'down'}>{fmtMoney(stopLossAmt, cur, true)}</b></>)}
      </div>

      {side === 'buy' && (
        <div className="risk">
          <label className="field">
            <span>風險試算：打算停損的價位（選填）<Help id="stoploss" /></span>
            <div className="row">
              <input type="number" inputMode="decimal" step="0.01" placeholder="例如跌 5% 就賣" value={riskStop} onChange={(e) => setRiskStop(e.target.value)} />
              {[0.03, 0.05, 0.1].map((d) => (
                <button key={d} className="btn sm ghost" onClick={() => setRiskStop(String(+(entry * (1 - d)).toFixed(2)))}>-{d * 100}%</button>
              ))}
            </div>
          </label>
          {rs > 0 && rs >= entry && <div className="note warn">停損價要低於買進價。</div>}
          {perShareLoss > 0 && (
            <>
              <div className="kv small">
                <span>到停損價賣出約虧損</span><b className="down">{fmtMoney(-loss, cur)}</b>
                <span>佔總資產</span><b className={lossPct > 0.02 ? 'down' : ''}>{fmtPct(lossPct, false, 2)}{lossPct > 0.02 ? '（偏高）' : ''}</b>
                <span>單筆風險 1% / 2% 最多買</span>
                <b>{fmtNum(suggest(0.01))} / {fmtNum(suggest(0.02))} {unit === 'lot' ? '張' : '股'}</b>
              </div>
              {type === 'market' && (
                <label className="chk"><input type="checkbox" checked={autoStop} onChange={(e) => setAutoStop(e.target.checked)} />買進後自動掛這個價位的停損單</label>
              )}
            </>
          )}
        </div>
      )}

      <div className="kv muted small">
        <span>可用{cur === 'TWD' ? '台幣' : '美元'}</span><span>{fmtMoney(cash, cur)}</span>
        <span>持有 / 可賣</span><span>{fmtNum(held)} / {fmtNum(sellable)} 股</span>
      </div>
      {!isOpen && type === 'market' && <div className="note">目前非交易時間，市價單會以最後成交價立即成交（標註盤後）。</div>}
      {type === 'stop' && <div className="note">停損單和限價賣單（停利）可以同時掛在同一批股票上，其中一張成交後，另一張會自動取消。</div>}
      {demo && <div className="note warn">示範資料：無法連線取得真實報價。</div>}
      <button className={`btn block ${side}`} disabled={qty <= 0 || px <= 0} onClick={submit}>
        {type === 'market' ? (side === 'buy' ? '市價買進' : '市價賣出') : type === 'stop' ? '掛停損單' : side === 'buy' ? '掛限價買單' : '掛限價賣單'}
      </button>
    </div>
  );
}
