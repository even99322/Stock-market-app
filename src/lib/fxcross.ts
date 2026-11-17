// 外幣兌台幣的交叉驗證與換算
// Yahoo 的部分台幣交叉匯率（例如 TWDCNY=X）偶爾會夾雜錯誤來源的報價，K 線變成一整片長條。
// 這裡用流動性最好的兩組美元匯率換算：XXX/台幣 = 美元/台幣 × 美元/XXX 的倒數（或 XXX/美元）。
import type { Bar, ChartData } from './types';

/** 各幣別對美元的報價：mul＝報價是「1 XXX 值多少美元」（EURUSD=X），div＝「1 美元換多少 XXX」（JPY=X） */
const LEGS: Record<string, { s: string; op: 'mul' | 'div' }> = {
  EUR: { s: 'EURUSD=X', op: 'mul' }, GBP: { s: 'GBPUSD=X', op: 'mul' }, AUD: { s: 'AUDUSD=X', op: 'mul' }, NZD: { s: 'NZDUSD=X', op: 'mul' },
  JPY: { s: 'JPY=X', op: 'div' }, HKD: { s: 'HKD=X', op: 'div' }, KRW: { s: 'KRW=X', op: 'div' }, SGD: { s: 'SGD=X', op: 'div' },
  THB: { s: 'THB=X', op: 'div' }, CAD: { s: 'CAD=X', op: 'div' }, CHF: { s: 'CHF=X', op: 'div' }, CNY: { s: 'CNY=X', op: 'div' },
};
export const USDTWD = 'TWD=X';

export interface FxPair { ccy: string; leg: string; op: 'mul' | 'div'; inverse: boolean; always: boolean }
/**
 * XXXTWD=X（1 外幣換多少台幣）或 TWDXXX=X（1 台幣換多少外幣）。
 * always：Yahoo 這組本身不可靠（人民幣），一律用換算值。
 */
export function fxPairOf(symbol: string): FxPair | null {
  const m = symbol.match(/^(?:([A-Z]{3})TWD|TWD([A-Z]{3}))=X$/);
  const ccy = m?.[1] || m?.[2];
  if (!ccy || !LEGS[ccy]) return null;
  return { ccy, leg: LEGS[ccy].s, op: LEGS[ccy].op, inverse: !!m![2], always: ccy === 'CNY' };
}

/** 兩組匯率合成一組：f(美元/台幣, 美元腿) */
export function fxValue(p: FxPair) {
  return (twd: number, leg: number) => {
    const v = p.op === 'mul' ? twd * leg : twd / leg;
    return p.inverse ? 1 / v : v;
  };
}

/**
 * 依時間對齊兩組 K 線（另一組缺值時沿用前一根），逐根換算。
 * 高低價取兩組各自極值帶入後的最大最小值（假設兩組的高低點不同時發生），是估計值。
 */
export function combineBars(a: Bar[], b: Bar[], f: (x: number, y: number) => number): Bar[] {
  const bt = b.map((x) => x.time);
  const out: Bar[] = [];
  let j = 0;
  for (const x of a) {
    while (j + 1 < b.length && bt[j + 1] <= x.time) j++;
    const y = b[j];
    if (!y || y.time > x.time + 86400) continue; // 另一組還沒有資料
    const o = f(x.open, y.open), c = f(x.close, y.close);
    const cand = [o, c, f(x.high, y.close), f(x.low, y.close), f(x.close, y.high), f(x.close, y.low)].filter(Number.isFinite);
    if (!Number.isFinite(o) || !Number.isFinite(c)) continue;
    out.push({ time: x.time, open: o, high: Math.max(...cand), low: Math.min(...cand), close: c, volume: 0 });
  }
  return out;
}

/** 換算後的完整走勢 */
export function synthChart(symbol: string, name: string, twd: ChartData, leg: ChartData, p: FxPair): ChartData {
  const f = fxValue(p);
  const bars = combineBars(twd.bars, leg.bars, f);
  const price = f(twd.price, leg.price);
  return {
    ...twd,
    symbol, name, bars, price,
    prevClose: f(twd.prevClose, leg.prevClose),
    high52: undefined as any, low52: undefined as any,
    exchangeName: '以美元匯率換算',
    fetchedAt: Date.now(),
  };
}

/** 直接報價是否可信：現價與換算值差距、或盤中有多根 K 線明顯偏離換算值 */
export function fxLooksBroken(direct: ChartData, synth: ChartData, tol = 0.01): boolean {
  if (!(direct.price > 0) || Math.abs(direct.price / synth.price - 1) > tol) return true;
  const m = new Map(synth.bars.map((b) => [b.time, b.close]));
  let bad = 0;
  for (const b of direct.bars) {
    const s = m.get(b.time);
    if (!s) continue;
    if (Math.abs(b.close / s - 1) > tol || Math.abs(b.low / s - 1) > tol * 2 || Math.abs(b.high / s - 1) > tol * 2) bad++;
  }
  return bad > Math.max(2, direct.bars.length * 0.02);
}

/**
 * 一般的盤中異常值清理（沒有換算來源的匯率用）：
 * 和前後各 6 根收盤價的中位數相差超過 tol 的價位，視為錯誤報價，拉回中位數。
 */
export function cleanSpikes(bars: Bar[], tol = 0.01): Bar[] {
  if (bars.length < 8) return bars;
  const c = bars.map((b) => b.close);
  return bars.map((b, i) => {
    const w = c.slice(Math.max(0, i - 6), i + 7).sort((x, y) => x - y);
    const med = w[w.length >> 1];
    const ok = (v: number) => Math.abs(v / med - 1) <= tol;
    if (ok(b.open) && ok(b.high) && ok(b.low) && ok(b.close)) return b;
    const fix = (v: number) => (ok(v) ? v : med);
    const o = fix(b.open), cl = fix(b.close);
    return { ...b, open: o, close: cl, high: Math.max(o, cl, fix(b.high)), low: Math.min(o, cl, fix(b.low)) };
  });
}
