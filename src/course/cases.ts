// 課程用的真實歷史資料（2025/08～2026/06 日 K；2026/08～10 的 5 分 K），打包在程式內，離線也能看
import raw from './data.json';
import { dateStr } from '../lib/format';
import type { Bar } from '../lib/types';

type Row = number[];
interface Daily { symbol: string; name: string; gmtoffset: number; bars: Row[] }
interface Intra extends Daily { date: string; prevClose: number }
export interface NewsRef { d: string; s: string; t: string; l: string }
const data = raw as unknown as {
  daily: Record<string, Daily>; intra: Record<string, Intra>;
  chips: Record<string, { inst: [string, number, number, number][]; margin: [string, number][] }>;
  news: Record<string, NewsRef[]>;
};

const toBar = (r: Row): Bar => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] });

export interface CaseData { symbol: string; name: string; gmtoffset: number; bars: Bar[]; dates: string[] }
const cache = new Map<string, CaseData>();
export function caseData(key: string): CaseData {
  let c = cache.get(key);
  if (!c) {
    const d = data.daily[key];
    if (!d) throw new Error(`unknown case ${key}`);
    const bars = d.bars.map(toBar);
    c = { symbol: d.symbol, name: d.name, gmtoffset: d.gmtoffset, bars, dates: bars.map((b) => dateStr(b.time, d.gmtoffset)) };
    cache.set(key, c);
  }
  return c;
}

/** 取 from～to 的 K 線，前面多帶 warm 根讓均線、指標有資料可算。回傳 visible = 區間內的根數 */
export function slice(key: string, from: string, to: string, warm = 70) {
  const c = caseData(key);
  let a = c.dates.findIndex((d) => d >= from);
  let b = -1;
  for (let i = 0; i < c.dates.length; i++) if (c.dates[i] <= to) b = i;
  if (a < 0) a = 0;
  const start = Math.max(0, a - warm);
  return { ...c, bars: c.bars.slice(start, b + 1), visible: b - a + 1, timeOf: (d: string) => c.bars[c.dates.indexOf(d)]?.time };
}

export function intraData(key: string) {
  const d = data.intra[key];
  const bars = d.bars.map(toBar);
  // 均價線（VWAP）：到目前為止「成交金額 ÷ 成交量」
  let pv = 0, vol = 0;
  const vwap = bars.map((b) => { pv += ((b.high + b.low + b.close) / 3) * b.volume; vol += b.volume; return vol ? pv / vol : null; });
  const hm = (t: number) => new Date((t + d.gmtoffset) * 1000).toISOString().slice(11, 16);
  return { ...d, bars, vwap, timeOf: (x: string) => bars.find((b) => hm(b.time) === x)?.time };
}

export const chipsData = (key = 'umc') => data.chips[key];
export const newsGroup = (g: string): NewsRef[] => data.news[g] || [];
export const caseKeys = () => Object.keys(data.daily);
export const intraKeys = () => Object.keys(data.intra);
