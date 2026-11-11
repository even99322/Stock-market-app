// 統計數據：報酬、波動、回撤、夏普值
import type { Bar } from './types';

export function returns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] > 0) out.push(values[i] / values[i - 1] - 1);
  return out;
}

export function mean(a: number[]) {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

/** 樣本標準差 */
export function stdev(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/** 最大回撤：從前高到後續最低點的最大跌幅（負值） */
export function maxDrawdown(values: number[]): { mdd: number; peakIdx: number; troughIdx: number } {
  let peak = values[0] ?? 0, peakIdx = 0, mdd = 0, best = { peakIdx: 0, troughIdx: 0 };
  for (let i = 0; i < values.length; i++) {
    if (values[i] > peak) { peak = values[i]; peakIdx = i; }
    const dd = peak > 0 ? values[i] / peak - 1 : 0;
    if (dd < mdd) { mdd = dd; best = { peakIdx, troughIdx: i }; }
  }
  return { mdd, ...best };
}

export interface PriceStats {
  periodReturn: number;
  annVol: number;
  cagr: number;
  sharpe: number;
  mdd: number;
  upDays: number;
  avgVol20: number;
  bestDay: number;
  worstDay: number;
}

/** periodsPerYear：日線 252、週線 52 */
export function priceStats(bars: Bar[], periodsPerYear = 252): PriceStats | null {
  if (bars.length < 3) return null;
  const closes = bars.map((b) => b.close);
  const r = returns(closes);
  const years = (bars[bars.length - 1].time - bars[0].time) / (365.25 * 86400);
  const total = closes[closes.length - 1] / closes[0] - 1;
  const sd = stdev(r);
  return {
    periodReturn: total,
    annVol: sd * Math.sqrt(periodsPerYear),
    cagr: years > 0.05 ? Math.pow(1 + total, 1 / years) - 1 : total,
    sharpe: sd > 0 ? (mean(r) / sd) * Math.sqrt(periodsPerYear) : 0,
    mdd: maxDrawdown(closes).mdd,
    upDays: r.filter((x) => x > 0).length / r.length,
    avgVol20: mean(bars.slice(-20).map((b) => b.volume)),
    bestDay: Math.max(...r),
    worstDay: Math.min(...r),
  };
}
