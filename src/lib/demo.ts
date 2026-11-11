// 無法連網時使用的「示範資料」：以代號為種子，產生可重現的隨機走勢。
import type { Bar, ChartData, Market } from './types';

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const OFFSET: Record<Market, number> = { TW: 8 * 3600, US: -5 * 3600 };
const OPEN_MIN: Record<Market, number> = { TW: 9 * 60, US: 9 * 60 + 30 };
const CLOSE_MIN: Record<Market, number> = { TW: 13 * 60 + 30, US: 16 * 60 };

const dailyCache = new Map<string, Bar[]>();

function round(p: number, market: Market) {
  if (market === 'US') return Math.round(p * 100) / 100;
  // 台股升降單位（簡化）
  const tick = p < 10 ? 0.01 : p < 50 ? 0.05 : p < 100 ? 0.1 : p < 500 ? 0.5 : p < 1000 ? 1 : 5;
  return +(Math.round(p / tick) * tick).toFixed(2);
}

export function demoDaily(symbol: string, market: Market): Bar[] {
  const key = symbol;
  const hit = dailyCache.get(key);
  if (hit) return hit;
  const h = hash(symbol);
  const r = rng(h);
  const years = 12;
  let price = market === 'TW' ? 20 + (h % 600) : 15 + (h % 300);
  if (symbol.startsWith('^')) price = market === 'TW' ? 8000 : 2000;
  let vol = 0.2 + (h % 25) / 100; // 年化波動 20%~45%
  let drift = 0.06;
  const baseVol = market === 'TW' ? 5_000_000 + (h % 30) * 1_000_000 : 10_000_000 + (h % 50) * 1_000_000;
  const out: Bar[] = [];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()));
  const openSec = (OPEN_MIN[market] * 60) - OFFSET[market];
  for (let d = new Date(start); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (r() < 0.004) drift = (r() - 0.4) * 0.6; // 偶爾切換多空趨勢
    if (r() < 0.004) vol = 0.15 + r() * 0.4;
    const dt = 1 / 252;
    const ret = (drift - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * gauss(r);
    const open = round(price * (1 + gauss(r) * vol * 0.15 * Math.sqrt(dt)), market);
    const close = round(price * Math.exp(ret), market);
    const span = Math.abs(gauss(r)) * vol * Math.sqrt(dt) * price * 0.6;
    const high = round(Math.max(open, close) + span * r(), market);
    const low = round(Math.max(0.01, Math.min(open, close) - span * r()), market);
    const volume = Math.round(baseVol * (0.5 + r()) * (1 + Math.abs(ret) * 20));
    out.push({ time: Math.floor(d.getTime() / 1000) + openSec, open, high, low, close, volume });
    price = close;
  }
  dailyCache.set(key, out);
  return out;
}

function aggregateWeekly(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const d = new Date(b.time * 1000);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
    const key = Math.floor(monday.getTime() / 1000);
    const last = out[out.length - 1];
    if (last && (last as any)._k === key) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume += b.volume;
    } else {
      const nb: any = { ...b, _k: key };
      out.push(nb);
    }
  }
  return out.map(({ _k, ...b }: any) => b);
}

function demoIntraday(symbol: string, market: Market, days: number, stepMin: number, daily: Bar[]): Bar[] {
  const r = rng(hash(symbol + ':intra:' + new Date().toISOString().slice(0, 10)));
  const nowSec = Date.now() / 1000;
  const out: Bar[] = [];
  const sel = daily.filter((b) => b.time <= nowSec).slice(-days);
  for (const d of sel) {
    const dayStart = d.time - OPEN_MIN[market] * 60; // 當地午夜（UTC 秒）
    const n = Math.floor((CLOSE_MIN[market] - OPEN_MIN[market]) / stepMin);
    let p = d.open;
    for (let i = 0; i < n; i++) {
      const t = dayStart + (OPEN_MIN[market] + i * stepMin) * 60;
      if (t > nowSec) break;
      const target = d.open + ((d.close - d.open) * (i + 1)) / n;
      const np = Math.min(d.high, Math.max(d.low, target + gauss(r) * (d.high - d.low) * 0.15));
      const o = p, c = round(np, market);
      out.push({
        time: t, open: o, close: c,
        high: Math.max(o, c) + (d.high - Math.max(o, c)) * r() * 0.3,
        low: Math.min(o, c) - (Math.min(o, c) - d.low) * r() * 0.3,
        volume: Math.round((d.volume / n) * (0.4 + r() * 1.2)),
      });
      p = c;
    }
  }
  return out;
}

export function isMarketOpenNow(market: Market): boolean {
  const local = new Date(Date.now() + OFFSET[market] * 1000);
  const wd = local.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const m = local.getUTCHours() * 60 + local.getUTCMinutes();
  return m >= OPEN_MIN[market] && m < CLOSE_MIN[market];
}

export function demoChart(symbol: string, name: string, market: Market, range: string): ChartData {
  const daily = demoDaily(symbol, market);
  let bars: Bar[];
  let intraday = false;
  const nowSec = Date.now() / 1000;
  const days = (n: number) => daily.filter((b) => b.time >= nowSec - n * 86400);
  switch (range) {
    case '1d': bars = demoIntraday(symbol, market, 1, 5, daily); intraday = true; break;
    case '5d': bars = demoIntraday(symbol, market, 5, 15, daily); intraday = true; break;
    case '1mo': bars = days(31); break;
    case '3mo': bars = days(92); break;
    case '6mo': bars = days(183); break;
    case '1y': bars = days(366); break;
    case '2y': bars = days(731); break;
    case '5y': bars = aggregateWeekly(days(1827)); break;
    default: bars = daily;
  }
  const started = daily.filter((b) => b.time <= nowSec);
  const last = started[started.length - 1];
  const prev = started[started.length - 2];
  const intraLast = intraday && bars.length ? bars[bars.length - 1].close : null;
  const yr = days(366);
  return {
    symbol, name, market,
    currency: market === 'TW' ? 'TWD' : 'USD',
    bars,
    price: intraLast ?? last.close,
    prevClose: prev.close,
    gmtoffset: OFFSET[market],
    isOpen: isMarketOpenNow(market),
    intraday,
    demo: true,
    tradable: !symbol.startsWith('^'),
    fetchedAt: Date.now(),
    high52: Math.max(...yr.map((b) => b.high)),
    low52: Math.min(...yr.map((b) => b.low)),
    exchangeName: '示範資料',
  };
}
