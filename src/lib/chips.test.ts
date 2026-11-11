import { describe, expect, it } from 'vitest';
import { analyzeChips, parseDividends, parseInst, parseMargin, streak } from './chips';
import { executeTrade, findFill, newAccount, placeLimitOrder, reservedQty } from './engine';
import { DEFAULT_SETTINGS } from './store';
import inst from './__fixtures__/fm_inst_2330.json';
import margin from './__fixtures__/fm_margin_2330.json';
import hold from './__fixtures__/fm_hold_2330.json';
import div from './__fixtures__/fm_div_2330.json';
import type { Bar } from './types';

const S = { ...DEFAULT_SETTINGS };

describe('籌碼', () => {
  it('三大法人（張）', () => {
    const d = parseInst((inst as any).data);
    const L = d[d.length - 1];
    expect(L.date).toBe('2026-11-11');
    // 外資 = (21,798,150 − 15,759,831)/1000 ＋ 外資自營；投信 = (2,572,276 − 187,000)/1000
    expect(L.trust).toBeCloseTo(2385.276, 2);
    expect(L.foreign).toBeGreaterThan(5000);
    expect(L.total).toBeCloseTo(L.foreign + L.trust + L.dealer, 5);
  });
  it('融資融券與解讀', () => {
    const m = parseMargin((margin as any).data);
    expect(m[m.length - 1]).toEqual({ date: '2026-11-11', margin: 32523, short: 93 });
    const ratio = (hold as any).data.map((r: any) => ({ date: r.date, ratio: r.ForeignInvestmentSharesRatio }));
    const ins = analyzeChips({ inst: parseInst((inst as any).data), margin: m, foreignRatio: ratio }, 0.05);
    expect(ins.length).toBeGreaterThanOrEqual(3);
    expect(ins[0].text).toContain('外資近 5 日');
  });
  it('連買連賣', () => {
    expect(streak([1, -1, 2, 3, 4])).toBe(3);
    expect(streak([1, -2, -3])).toBe(-2);
    expect(streak([1, 0])).toBe(0);
  });
  it('股利', () => {
    const d = parseDividends((div as any).data);
    expect(d[0].exDate >= d[1].exDate).toBe(true);
    const x = d.find((r) => r.exDate === '2026-06-11')!;
    expect(x.cash).toBeCloseTo(6.0, 3);
    expect(x.payDate).toBe('2026-07-09');
  });
});

describe('停損單', () => {
  const buy = () => executeTrade(newAccount(S), { symbol: 'AAPL', name: 'A', market: 'US', side: 'buy', qty: 100, price: 100 }, S);
  const bar = (t: number, o: number, h: number, l: number, c: number): Bar => ({ time: t, open: o, high: h, low: l, close: c, volume: 1 });
  it('停利與停損共用持股，一張成交另一張取消', () => {
    let a = buy();
    a = placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 100, limit: 120 }, S);
    a = placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 100, limit: 90, kind: 'stop' }, S);
    expect(a.orders.length).toBe(2);
    expect(reservedQty(a, 'AAPL')).toBe(100);
    expect(() => placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 1, limit: 80, kind: 'stop' }, S)).toThrow();
    const stop = a.orders.find((o) => o.kind === 'stop')!;
    const t = stop.createdAt / 1000;
    expect(findFill(stop, [bar(t + 60, 99, 101, 95, 96)])).toBeNull();
    expect(findFill(stop, [bar(t + 60, 95, 96, 89, 90)])!.price).toBe(90);
    expect(findFill(stop, [bar(t + 60, 85, 86, 84, 85)])!.price).toBe(85); // 跳空以開盤價
    a = executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 100, price: 90, orderId: stop.id }, S);
    expect(a.positions.AAPL).toBeUndefined();
    expect(a.orders.length).toBe(0);
    expect(a.realized.USD).toBe(-1000);
  });
  it('市價賣出不能動用已掛單的股數；買進不能掛停損', () => {
    let a = buy();
    a = placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 60, limit: 90, kind: 'stop' }, S);
    expect(() => executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 50, price: 100 }, S)).toThrow();
    a = executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 40, price: 100 }, S);
    expect(a.orders.length).toBe(1);
    expect(() => placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'buy', qty: 1, limit: 90, kind: 'stop' }, S)).toThrow();
  });
});
