// 模擬交易引擎（純函式，傳入舊帳戶、回傳新帳戶，錯誤時丟出 Error）
import { calcFees } from './fees';
import type { Account, Bar, Currency, Market, PendingOrder, ReplaySession, Settings, Side, Trade } from './types';

export const curOf = (m: Market): Currency => (m === 'TW' ? 'TWD' : 'USD');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const r2 = (x: number) => Math.round(x * 100) / 100;

export function newAccount(s: Settings): Account {
  return {
    cash: { TWD: s.initialTWD, USD: s.initialUSD },
    initial: { TWD: s.initialTWD, USD: s.initialUSD },
    positions: {},
    orders: [],
    trades: [],
    fx: [],
    realized: { TWD: 0, USD: 0 },
    equityLog: [],
    createdAt: Date.now(),
  };
}

/** 掛單中的買單預先保留的現金 */
export function reservedCash(acc: Account, cur: Currency, s: Settings, excludeId?: string) {
  return acc.orders
    .filter((o) => o.side === 'buy' && curOf(o.market) === cur && o.id !== excludeId)
    .reduce((sum, o) => sum + calcFees(o.market, o.symbol, 'buy', o.qty, o.limit, s).net, 0);
}
export function reservedQty(acc: Account, symbol: string, excludeId?: string) {
  return acc.orders.filter((o) => o.side === 'sell' && o.symbol === symbol && o.id !== excludeId).reduce((a, o) => a + o.qty, 0);
}
export const availableCash = (acc: Account, cur: Currency, s: Settings, excludeId?: string) =>
  acc.cash[cur] - reservedCash(acc, cur, s, excludeId);
export const availableQty = (acc: Account, symbol: string, excludeId?: string) =>
  (acc.positions[symbol]?.qty ?? 0) - reservedQty(acc, symbol, excludeId);

export interface TradeInput {
  symbol: string;
  name: string;
  market: Market;
  side: Side;
  qty: number;
  price: number;
  time?: number;
  note?: string;
  orderId?: string;
}

function validateQty(qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('數量必須是正整數');
}

export function executeTrade(acc0: Account, t: TradeInput, s: Settings): Account {
  validateQty(t.qty);
  if (!(t.price > 0)) throw new Error('價格不正確');
  const acc = clone(acc0);
  const cur = curOf(t.market);
  const f = calcFees(t.market, t.symbol, t.side, t.qty, t.price, s);
  const trade: Trade = {
    id: uid(), time: t.time ?? Date.now(), symbol: t.symbol, name: t.name, market: t.market,
    side: t.side, qty: t.qty, price: t.price, fee: f.fee, tax: f.tax,
    amount: t.side === 'buy' ? -f.net : f.net, note: t.note,
  };
  if (t.side === 'buy') {
    const avail = availableCash(acc, cur, s, t.orderId);
    if (f.net > avail + 1e-6) throw new Error(`可用資金不足：需要 ${fmtN(f.net)}，可用 ${fmtN(avail)} ${cur}`);
    const p = acc.positions[t.symbol] ?? { symbol: t.symbol, name: t.name, market: t.market, currency: cur, qty: 0, avgCost: 0 };
    p.avgCost = (p.avgCost * p.qty + f.net) / (p.qty + t.qty);
    p.qty += t.qty;
    p.name = t.name;
    acc.positions[t.symbol] = p;
    acc.cash[cur] = r2(acc.cash[cur] - f.net);
  } else {
    const avail = availableQty(acc, t.symbol, t.orderId);
    if (t.qty > avail) throw new Error(`可賣股數不足：持有可賣 ${avail} 股`);
    const p = acc.positions[t.symbol];
    const realized = r2(f.net - p.avgCost * t.qty);
    trade.realized = realized;
    acc.realized[cur] = r2(acc.realized[cur] + realized);
    p.qty -= t.qty;
    if (p.qty === 0) delete acc.positions[t.symbol];
    acc.cash[cur] = r2(acc.cash[cur] + f.net);
  }
  if (t.orderId) acc.orders = acc.orders.filter((o) => o.id !== t.orderId);
  acc.trades.unshift(trade);
  return acc;
}

export function placeLimitOrder(acc0: Account, o: Omit<PendingOrder, 'id' | 'createdAt'>, s: Settings): Account {
  validateQty(o.qty);
  if (!(o.limit > 0)) throw new Error('限價必須大於 0');
  const cur = curOf(o.market);
  if (o.side === 'buy') {
    const need = calcFees(o.market, o.symbol, 'buy', o.qty, o.limit, s).net;
    const avail = availableCash(acc0, cur, s);
    if (need > avail + 1e-6) throw new Error(`可用資金不足：需要 ${fmtN(need)}，可用 ${fmtN(avail)} ${cur}`);
  } else if (o.qty > availableQty(acc0, o.symbol)) {
    throw new Error(`可賣股數不足：持有可賣 ${availableQty(acc0, o.symbol)} 股`);
  }
  const acc = clone(acc0);
  acc.orders.push({ ...o, id: uid(), createdAt: Date.now() });
  return acc;
}

export function cancelOrder(acc0: Account, id: string): Account {
  const acc = clone(acc0);
  acc.orders = acc.orders.filter((o) => o.id !== id);
  return acc;
}

/**
 * 檢查限價單是否成交：掃描下單之後的 K 線，
 * 買單：某根 K 線最低價 ≤ 限價 → 成交（若開盤就低於限價，以開盤價成交）
 * 賣單：某根 K 線最高價 ≥ 限價 → 成交（若開盤就高於限價，以開盤價成交）
 */
export function findFill(order: PendingOrder, bars: Bar[]): { price: number; time: number } | null {
  const since = order.createdAt / 1000;
  for (const b of bars) {
    if (b.time < since - 60) continue;
    if (order.side === 'buy' && b.low <= order.limit) return { price: Math.min(order.limit, b.open), time: b.time * 1000 };
    if (order.side === 'sell' && b.high >= order.limit) return { price: Math.max(order.limit, b.open), time: b.time * 1000 };
  }
  return null;
}

/** 換匯：rate = 1 美元兌多少台幣 */
export function exchangeFx(acc0: Account, from: Currency, amount: number, rate: number, s: Settings): Account {
  if (!(amount > 0)) throw new Error('金額必須大於 0');
  if (amount > availableCash(acc0, from, s) + 1e-6) throw new Error('可用資金不足');
  const to: Currency = from === 'TWD' ? 'USD' : 'TWD';
  const out = from === 'TWD' ? r2(amount / rate) : Math.round(amount * rate);
  const acc = clone(acc0);
  acc.cash[from] = r2(acc.cash[from] - amount);
  acc.cash[to] = r2(acc.cash[to] + out);
  acc.fx.unshift({ id: uid(), time: Date.now(), from, to, fromAmount: amount, toAmount: out, rate });
  return acc;
}

export function recordEquity(acc0: Account, totalTwd: number): Account {
  const d = new Date().toISOString().slice(0, 10);
  const last = acc0.equityLog[acc0.equityLog.length - 1];
  // 同一天內變動 < 0.2% 不寫入，避免頻繁觸發雲端同步
  if (last && last.d === d && Math.abs(last.v - totalTwd) < Math.max(1, last.v * 0.002)) return acc0;
  const acc = clone(acc0);
  if (last && last.d === d) acc.equityLog[acc.equityLog.length - 1].v = Math.round(totalTwd);
  else acc.equityLog.push({ d, v: Math.round(totalTwd) });
  if (acc.equityLog.length > 2000) acc.equityLog = acc.equityLog.slice(-2000);
  return acc;
}

export function fmtN(n: number, digits = 0) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
}

// ---------------- 歷史回放 ----------------
export function replayTrade(sess0: ReplaySession, side: Side, qty: number, price: number, time: number, s: Settings): ReplaySession {
  validateQty(qty);
  const sess = clone(sess0);
  const f = calcFees(sess.market, sess.symbol, side, qty, price, s);
  const trade: Trade = {
    id: uid(), time, symbol: sess.symbol, name: sess.name, market: sess.market, side, qty, price,
    fee: f.fee, tax: f.tax, amount: side === 'buy' ? -f.net : f.net,
  };
  if (side === 'buy') {
    if (f.net > sess.cash + 1e-6) throw new Error(`資金不足：需要 ${fmtN(f.net)}，現金 ${fmtN(sess.cash)}`);
    sess.avgCost = (sess.avgCost * sess.qty + f.net) / (sess.qty + qty);
    sess.qty += qty;
    sess.cash = r2(sess.cash - f.net);
  } else {
    if (qty > sess.qty) throw new Error(`持股不足：目前 ${sess.qty} 股`);
    trade.realized = r2(f.net - sess.avgCost * qty);
    sess.realized = r2(sess.realized + trade.realized);
    sess.qty -= qty;
    if (sess.qty === 0) sess.avgCost = 0;
    sess.cash = r2(sess.cash + f.net);
  }
  sess.trades.unshift(trade);
  return sess;
}

/** 以固定金額買進能買到的最大股數（台股以張為單位時傳 lot=1000） */
export function maxBuyQty(cash: number, price: number, market: Market, symbol: string, s: Settings, lot = 1) {
  if (price <= 0) return 0;
  let q = Math.floor(cash / price / lot) * lot;
  while (q > 0 && calcFees(market, symbol, 'buy', q, price, s).net > cash) q -= lot;
  return Math.max(q, 0);
}
