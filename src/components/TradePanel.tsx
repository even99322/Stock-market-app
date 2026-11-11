import { useEffect, useState } from 'react';
import { calcFees } from '../lib/fees';
import { availableCash, availableQty, curOf, executeTrade, maxBuyQty, placeLimitOrder } from '../lib/engine';
import { fmtMoney, fmtNum, fmtPrice } from '../lib/format';
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

export function TradePanel({ symbol, name, market, price, isOpen, demo }: Props) {
  const app = useApp();
  const { toast } = useUi();
  const s = app.settings;
  const acc = app.account;
  const cur = curOf(market);
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [unit, setUnit] = useState<'lot' | 'share'>(market === 'TW' ? 'lot' : 'share');
  const [qtyText, setQtyText] = useState('1');
  const [limitText, setLimitText] = useState('');

  useEffect(() => { setLimitText(price ? String(+price.toFixed(2)) : ''); }, [symbol]); // eslint-disable-line
  useEffect(() => { setUnit(market === 'TW' ? 'lot' : 'share'); setQtyText('1'); }, [market, symbol]);

  const lot = unit === 'lot' ? 1000 : 1;
  const qty = Math.round((parseFloat(qtyText) || 0) * lot);
  const px = type === 'limit' ? parseFloat(limitText) || 0 : price;
  const f = calcFees(market, symbol, side, qty, px, s);
  const cash = availableCash(acc, cur, s);
  const held = acc.positions[symbol]?.qty ?? 0;
  const sellable = availableQty(acc, symbol);

  const setMax = () => {
    if (side === 'buy') setQtyText(String(maxBuyQty(cash, px, market, symbol, s, lot) / lot));
    else setQtyText(String(Math.floor(sellable / lot)));
  };

  const submit = () => {
    try {
      if (demo && type === 'market') {
        if (!confirm('目前是「示範資料」（無法取得真實報價），確定要用示範價格成交嗎？')) return;
      }
      if (type === 'market') {
        const next = executeTrade(acc, {
          symbol, name, market, side, qty, price,
          note: isOpen ? undefined : '盤後（以最後成交價）',
        }, s);
        store.update((st) => ({ ...st, account: next }));
        toast(`${side === 'buy' ? '買進' : '賣出'} ${name} ${fmtNum(qty)} 股 @ ${fmtPrice(price, market)} 成交`);
      } else {
        const next = placeLimitOrder(acc, { symbol, name, market, side, qty, limit: px }, s);
        store.update((st) => ({ ...st, account: next }));
        toast(`已掛${side === 'buy' ? '買' : '賣'}單 ${fmtNum(qty)} 股 @ ${fmtPrice(px, market)}，觸價後自動成交`, 'info');
      }
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  return (
    <div className="card trade">
      <div className="card-title">模擬下單 <Help id="order" /></div>
      <Seg value={side} onChange={setSide} options={[{ v: 'buy', label: '買進' }, { v: 'sell', label: '賣出' }]} />
      <div className="row gap">
        <Seg small value={type} onChange={setType} options={[{ v: 'market', label: '市價' }, { v: 'limit', label: '限價' }]} />
        {market === 'TW' && (
          <Seg small value={unit} onChange={(u) => { setUnit(u); setQtyText('1'); }} options={[{ v: 'lot', label: '張' }, { v: 'share', label: '股(零股)' }]} />
        )}
        <Help id="lot" />
      </div>
      {type === 'limit' && (
        <label className="field">
          <span>限價</span>
          <input type="number" inputMode="decimal" step="0.01" value={limitText} onChange={(e) => setLimitText(e.target.value)} />
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
        <span>{type === 'market' ? '參考價' : '限價'}</span><b>{fmtPrice(px, market)}</b>
        <span>成交金額</span><b>{fmtMoney(f.gross, cur)}</b>
        <span>手續費 <Help id="fees" /></span><b>{fmtMoney(f.fee, cur)}</b>
        {market === 'TW' && side === 'sell' && (<><span>證交稅</span><b>{fmtMoney(f.tax, cur)}</b></>)}
        <span>{side === 'buy' ? '預估付出' : '預估入帳'}</span><b className="big">{fmtMoney(f.net, cur)}</b>
      </div>
      <div className="kv muted small">
        <span>可用{cur === 'TWD' ? '台幣' : '美元'}</span><span>{fmtMoney(cash, cur)}</span>
        <span>持有 / 可賣</span><span>{fmtNum(held)} / {fmtNum(sellable)} 股</span>
      </div>
      {!isOpen && type === 'market' && <div className="note">目前非交易時間，市價單會以最後成交價立即成交（標註盤後）。</div>}
      {demo && <div className="note warn">示範資料：無法連線取得真實報價。</div>}
      <button className={`btn block ${side}`} disabled={qty <= 0 || px <= 0} onClick={submit}>
        {type === 'market' ? (side === 'buy' ? '市價買進' : '市價賣出') : side === 'buy' ? '掛限價買單' : '掛限價賣單'}
      </button>
    </div>
  );
}
