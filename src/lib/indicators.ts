// 技術指標計算。所有函式回傳與輸入等長的陣列，資料不足處為 null。
// 刻意寫得直白，方便對照學習中心的公式說明。
import type { Bar } from './types';

export type Series = (number | null)[];

/** 簡單移動平均 SMA(n) = 最近 n 筆收盤價的平均 */
export function sma(values: number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** 指數移動平均 EMA：越近的價格權重越大，α = 2/(n+1)。以前 n 筆 SMA 作為起始值 */
export function ema(values: number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** 布林通道：中線 = SMA(n)，上下軌 = 中線 ± k 倍標準差 */
export function bollinger(values: number[], n = 20, k = 2) {
  const mid = sma(values, n);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = n - 1; i < values.length; i++) {
    const m = mid[i]!;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (values[j] - m) ** 2;
    const sd = Math.sqrt(v / n);
    upper[i] = m + k * sd;
    lower[i] = m - k * sd;
  }
  return { mid, upper, lower };
}

/** RSI（Wilder 平滑法）= 100 - 100/(1+RS)，RS = 平均漲幅 / 平均跌幅 */
export function rsi(values: number[], n = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** MACD：DIF = EMA12 - EMA26；DEA(訊號線) = DIF 的 EMA9；柱狀 = DIF - DEA */
export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const dif: Series = values.map((_, i) => (ef[i] != null && es[i] != null ? ef[i]! - es[i]! : null));
  const start = dif.findIndex((v) => v != null);
  const dea: Series = new Array(values.length).fill(null);
  if (start >= 0) {
    const sig = ema(dif.slice(start) as number[], signal);
    sig.forEach((v, i) => (dea[start + i] = v));
  }
  const hist: Series = dif.map((v, i) => (v != null && dea[i] != null ? v - dea[i]! : null));
  return { dif, dea, hist };
}

/**
 * KD 隨機指標（台灣常用 9,3,3）
 * RSV = (今收 - 9日最低) / (9日最高 - 9日最低) × 100
 * K = 2/3 × 前K + 1/3 × RSV；D = 2/3 × 前D + 1/3 × K（起始 K=D=50）
 */
export function kd(bars: Bar[], n = 9) {
  const K: Series = new Array(bars.length).fill(null);
  const D: Series = new Array(bars.length).fill(null);
  let k = 50, d = 50;
  for (let i = n - 1; i < bars.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      hi = Math.max(hi, bars[j].high);
      lo = Math.min(lo, bars[j].low);
    }
    const rsv = hi === lo ? 50 : ((bars[i].close - lo) / (hi - lo)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    K[i] = k;
    D[i] = d;
  }
  return { K, D };
}

/** 能量潮 OBV：上漲日加成交量、下跌日減成交量 */
export function obv(bars: Bar[]): Series {
  let v = 0;
  return bars.map((b, i) => {
    if (i > 0) {
      if (b.close > bars[i - 1].close) v += b.volume;
      else if (b.close < bars[i - 1].close) v -= b.volume;
    }
    return v;
  });
}
