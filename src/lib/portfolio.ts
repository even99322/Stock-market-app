// 帳戶估值、限價單撮合、資產快照（背景定時執行）
import { executeTrade, findFill, recordEquity, curOf } from './engine';
import { fetchChart, fetchQuote, fetchUsdTwd, type Quote } from './market';
import { store } from './store';
import type { Account, Currency, Trade } from './types';

export interface CurTotals { cash: number; mv: number; cost: number; unreal: number; total: number }
export interface Totals {
  byCur: Record<Currency, CurTotals>;
  totalTwd: number;
  initialTwd: number;
  rate: number;
}

export function computeTotals(acc: Account, quotes: Record<string, Quote | undefined>, rate: number): Totals {
  const byCur: Record<Currency, CurTotals> = {
    TWD: { cash: acc.cash.TWD, mv: 0, cost: 0, unreal: 0, total: 0 },
    USD: { cash: acc.cash.USD, mv: 0, cost: 0, unreal: 0, total: 0 },
  };
  for (const p of Object.values(acc.positions)) {
    const c = byCur[curOf(p.market)];
    const price = quotes[p.symbol]?.price ?? p.avgCost;
    c.mv += price * p.qty;
    c.cost += p.avgCost * p.qty;
  }
  for (const c of Object.values(byCur)) {
    c.unreal = c.mv - c.cost;
    c.total = c.cash + c.mv;
  }
  return {
    byCur,
    totalTwd: byCur.TWD.total + byCur.USD.total * rate,
    initialTwd: acc.initial.TWD + acc.initial.USD * rate,
    rate,
  };
}

export const live = {
  quotes: {} as Record<string, Quote | undefined>,
  rate: 32,
  rateDemo: true,
};

/** 檢查掛單是否成交，回傳本次成交的交易 */
export async function checkOrders(): Promise<Trade[]> {
  const filled: Trade[] = [];
  const orders = [...store.get().account.orders];
  for (const o of orders) {
    const ageDays = (Date.now() - o.createdAt) / 86400000;
    const range = ageDays < 1 ? '1d' : ageDays < 5 ? '5d' : '1mo';
    try {
      const c = await fetchChart(o.symbol, range, true);
      if (c.demo) continue; // 示範資料不撮合，避免假成交
      const fill = findFill(o, c.bars);
      if (!fill) continue;
      const s = store.get();
      if (!s.account.orders.some((x) => x.id === o.id)) continue;
      const acc = executeTrade(s.account, {
        symbol: o.symbol, name: o.name, market: o.market, side: o.side, qty: o.qty,
        price: fill.price, time: fill.time, orderId: o.id, note: '限價單成交',
      }, s.settings);
      store.update((st) => ({ ...st, account: acc }));
      filled.push(acc.trades[0]);
    } catch { /* 下次再試 */ }
  }
  return filled;
}

/** 更新持股報價與匯率，並記錄今日資產 */
export async function refreshPortfolio(force = false) {
  const acc = store.get().account;
  const syms = Object.keys(acc.positions);
  await Promise.all(
    syms.map(async (s) => {
      try { live.quotes[s] = await fetchQuote(s, force); } catch { /* ignore */ }
    }),
  );
  const fx = await fetchUsdTwd();
  live.rate = fx.rate;
  live.rateDemo = fx.demo;
  const t = computeTotals(store.get().account, live.quotes, live.rate);
  const next = recordEquity(store.get().account, t.totalTwd);
  if (next !== store.get().account) store.update((s) => ({ ...s, account: next }));
  return t;
}

export function rateFor(cur: Currency) {
  return cur === 'USD' ? live.rate : 1;
}
