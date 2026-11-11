import { describe, expect, it } from 'vitest';
import { sma, ema, rsi, macd, kd, bollinger } from './indicators';
import { calcFees } from './fees';
import { executeTrade, placeLimitOrder, findFill, availableCash, newAccount, replayTrade, exchangeFx, maxBuyQty } from './engine';
import { maxDrawdown, priceStats } from './stats';
import { DEFAULT_SETTINGS } from './store';
import type { Bar, ReplaySession } from './types';

const S = { ...DEFAULT_SETTINGS };

describe('indicators', () => {
  it('sma', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it('ema seeds with sma', () => {
    const e = ema([1, 2, 3, 4], 3);
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
  });
  it('rsi all-up = 100, alternating ~50', () => {
    expect(rsi([1, 2, 3, 4, 5, 6], 3)[5]).toBe(100);
    const alt = Array.from({ length: 40 }, (_, i) => (i % 2 ? 11 : 10));
    expect(rsi(alt, 14)[39]!).toBeGreaterThan(40);
    expect(rsi(alt, 14)[39]!).toBeLessThan(60);
  });
  it('macd on flat series is 0', () => {
    const m = macd(Array(60).fill(10));
    expect(m.dif[59]).toBeCloseTo(0);
    expect(m.hist[59]).toBeCloseTo(0);
    expect(m.dea[33]).not.toBeNull();
    expect(m.dea[32]).toBeNull();
  });
  it('kd at top of range → K rises toward 100', () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => ({ time: i, open: i, high: i + 1, low: i - 1, close: i + 1, volume: 1 }));
    const { K, D } = kd(bars);
    expect(K[29]!).toBeGreaterThan(90);
    expect(D[29]!).toBeLessThan(K[29]!);
  });
  it('bollinger flat → bands collapse', () => {
    const b = bollinger(Array(25).fill(5));
    expect(b.upper[24]).toBe(5);
    expect(b.lower[24]).toBe(5);
  });
});

describe('fees', () => {
  it('台股：買 1 張 600 元，六折', () => {
    const f = calcFees('TW', '2330.TW', 'buy', 1000, 600, S);
    expect(f.fee).toBe(Math.floor(600000 * 0.001425 * 0.6)); // 513
    expect(f.tax).toBe(0);
    expect(f.net).toBe(600513);
  });
  it('台股：賣股票稅 0.3%、ETF 0.1%、最低手續費 20', () => {
    expect(calcFees('TW', '2330.TW', 'sell', 1000, 600, S).tax).toBe(1800);
    expect(calcFees('TW', '0050.TW', 'sell', 1000, 150, S).tax).toBe(150);
    expect(calcFees('TW', '2330.TW', 'buy', 1, 600, S).fee).toBe(20);
  });
});

describe('engine', () => {
  it('buy then sell computes realized PnL with fees', () => {
    let a = newAccount(S);
    a = executeTrade(a, { symbol: '2330.TW', name: '台積電', market: 'TW', side: 'buy', qty: 1000, price: 600 }, S);
    expect(a.cash.TWD).toBe(1_000_000 - 600513);
    expect(a.positions['2330.TW'].avgCost).toBeCloseTo(600.513);
    a = executeTrade(a, { symbol: '2330.TW', name: '台積電', market: 'TW', side: 'sell', qty: 1000, price: 650 }, S);
    const fee = Math.floor(650000 * 0.001425 * 0.6), tax = 1950;
    expect(a.realized.TWD).toBeCloseTo(650000 - fee - tax - 600513);
    expect(a.positions['2330.TW']).toBeUndefined();
  });
  it('rejects overspend and oversell', () => {
    const a = newAccount(S);
    expect(() => executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'buy', qty: 1000, price: 200 }, S)).toThrow();
    expect(() => executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'sell', qty: 1, price: 200 }, S)).toThrow();
  });
  it('limit order reserves cash and fills on touch', () => {
    let a = newAccount(S);
    a = placeLimitOrder(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'buy', qty: 100, limit: 200 }, S);
    expect(availableCash(a, 'USD', S)).toBe(30000 - 20000);
    const o = a.orders[0];
    const t = o.createdAt / 1000;
    const bars: Bar[] = [
      { time: t + 60, open: 210, high: 212, low: 205, close: 206, volume: 1 },
      { time: t + 120, open: 199, high: 201, low: 198, close: 200, volume: 1 },
    ];
    const fill = findFill(o, bars)!;
    expect(fill.price).toBe(199); // 跳空開低於限價 → 以開盤價成交
    a = executeTrade(a, { symbol: 'AAPL', name: 'A', market: 'US', side: 'buy', qty: 100, price: fill.price, orderId: o.id }, S);
    expect(a.orders.length).toBe(0);
    expect(a.cash.USD).toBe(30000 - 19900);
  });
  it('fx', () => {
    const a = exchangeFx(newAccount(S), 'TWD', 32000, 32, S);
    expect(a.cash.USD).toBe(31000);
    expect(a.cash.TWD).toBe(968000);
  });
  it('maxBuyQty respects fees', () => {
    const q = maxBuyQty(100000, 100, 'TW', '2330.TW', S);
    expect(calcFees('TW', '2330.TW', 'buy', q, 100, S).net).toBeLessThanOrEqual(100000);
    expect(calcFees('TW', '2330.TW', 'buy', q + 1, 100, S).net).toBeGreaterThan(100000);
  });
  it('replay trade', () => {
    const s0: ReplaySession = { id: 'x', symbol: 'AAPL', name: 'A', market: 'US', currency: 'USD', startDate: '', curDate: '', initialCash: 10000, cash: 10000, qty: 0, avgCost: 0, realized: 0, trades: [], equity: [], blind: false, finished: false, createdAt: 0 };
    const s1 = replayTrade(s0, 'buy', 10, 100, 0, S);
    const s2 = replayTrade(s1, 'sell', 10, 110, 0, S);
    expect(s2.cash).toBe(10100);
    expect(s2.realized).toBe(100);
  });
});

describe('stats', () => {
  it('max drawdown', () => {
    expect(maxDrawdown([100, 120, 60, 130, 65]).mdd).toBeCloseTo(-0.5);
  });
  it('priceStats', () => {
    const bars: Bar[] = Array.from({ length: 253 }, (_, i) => ({ time: i * 86400 * 365.25 / 252, open: 1, high: 1, low: 1, close: 100 * 1.001 ** i, volume: 1 }));
    const st = priceStats(bars)!;
    expect(st.periodReturn).toBeCloseTo(1.001 ** 252 - 1, 5);
    expect(st.annVol).toBeCloseTo(0, 5);
    expect(st.cagr).toBeCloseTo(st.periodReturn, 2);
  });
});

describe('updater version compare', async () => {
  const { newer } = await import('./updater');
  it('semver', () => {
    expect(newer('1.0.1', '1.0.0')).toBe(true);
    expect(newer('v1.2.10', '1.2.9')).toBe(true);
    expect(newer('1.0.0', '1.0.0')).toBe(false);
    expect(newer('0.9.9', '1.0.0')).toBe(false);
  });
});
