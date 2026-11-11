import { getJSON, HttpError, NetworkError } from './http';
import { demoChart } from './demo';
import { isIndex, lookupName, marketOf } from './names';
import type { Bar, ChartData } from './types';

/** 圖表區間 → Yahoo range/interval */
export const RANGES: Record<string, { label: string; interval: string; ttl: number }> = {
  '1d': { label: '1日', interval: '5m', ttl: 20_000 },
  '5d': { label: '5日', interval: '15m', ttl: 60_000 },
  '1mo': { label: '1月', interval: '1d', ttl: 120_000 },
  '6mo': { label: '6月', interval: '1d', ttl: 300_000 },
  '1y': { label: '1年', interval: '1d', ttl: 300_000 },
  '5y': { label: '5年', interval: '1wk', ttl: 600_000 },
  '10y': { label: '10年', interval: '1d', ttl: 3_600_000 },
};

const cache = new Map<string, ChartData>();
/** 最近一次是否因為離線而使用示範資料 */
export const dataStatus = { offline: false, lastError: '' };

async function fetchYahoo(symbol: string, range: string): Promise<ChartData> {
  const interval = RANGES[range]?.interval || '1d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const data = await getJSON<any>(url);
  const res = data?.chart?.result?.[0];
  if (!res) throw new HttpError(404, data?.chart?.error?.description || '找不到此代號');
  const meta = res.meta || {};
  const ts: number[] = res.timestamp || [];
  const q = res.indicators?.quote?.[0] || {};
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    bars.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 });
  }
  if (!bars.length && meta.regularMarketPrice == null) throw new HttpError(404, '沒有資料');
  const market = marketOf(symbol);
  const per = meta.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  const intraday = !/d|wk|mo/.test(interval);
  const price = meta.regularMarketPrice ?? bars[bars.length - 1]?.close;
  let prevClose: number = meta.previousClose ?? meta.chartPreviousClose;
  if (!intraday && bars.length >= 2) {
    // 日線：若最後一根是今天，前收 = 倒數第二根
    const last = bars[bars.length - 1];
    const lastDay = Math.floor((last.time + (meta.gmtoffset || 0)) / 86400);
    const mktDay = Math.floor(((meta.regularMarketTime || last.time) + (meta.gmtoffset || 0)) / 86400);
    prevClose = lastDay === mktDay ? bars[bars.length - 2].close : last.close;
  }
  return {
    symbol: meta.symbol || symbol,
    name: lookupName(symbol) || meta.longName || meta.shortName || symbol,
    market,
    currency: market === 'TW' ? 'TWD' : 'USD',
    bars,
    price,
    prevClose: prevClose ?? price,
    gmtoffset: meta.gmtoffset ?? (market === 'TW' ? 28800 : -18000),
    isOpen: !!per && now >= per.start && now < per.end,
    intraday,
    demo: false,
    tradable: !isIndex(symbol),
    fetchedAt: Date.now(),
    high52: meta.fiftyTwoWeekHigh,
    low52: meta.fiftyTwoWeekLow,
    exchangeName: meta.fullExchangeName || meta.exchangeName,
  };
}

/**
 * 取得 K 線資料。連不上網路時回傳示範資料（demo=true）；
 * 代號不存在時丟出錯誤。
 */
export async function fetchChart(symbol: string, range = '6mo', force = false): Promise<ChartData> {
  const key = `${symbol}|${range}`;
  const hit = cache.get(key);
  const ttl = RANGES[range]?.ttl ?? 60_000;
  if (!force && hit && Date.now() - hit.fetchedAt < ttl) return hit;
  let data: ChartData;
  try {
    try {
      data = await fetchYahoo(symbol, range);
    } catch (e) {
      // 上市找不到就試上櫃
      if (e instanceof HttpError && /^\d{4,6}[A-Z]?\.TW$/.test(symbol)) {
        data = await fetchYahoo(symbol + 'O', range);
      } else throw e;
    }
    dataStatus.offline = false;
  } catch (e) {
    if (e instanceof NetworkError) {
      dataStatus.offline = true;
      dataStatus.lastError = e.message;
      const mk = marketOf(symbol);
      data = demoChart(symbol, lookupName(symbol) || symbol, mk, range);
    } else throw e;
  }
  cache.set(key, data);
  if (data.symbol !== symbol) cache.set(`${data.symbol}|${range}`, data);
  return data;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  isOpen: boolean;
  demo: boolean;
  market: ChartData['market'];
  currency: ChartData['currency'];
  tradable: boolean;
}

export async function fetchQuote(symbol: string, force = false): Promise<Quote> {
  const c = await fetchChart(symbol, '1d', force);
  const change = c.price - c.prevClose;
  return {
    symbol: c.symbol, name: c.name, price: c.price, prevClose: c.prevClose,
    change, changePct: c.prevClose ? (change / c.prevClose) * 100 : 0,
    isOpen: c.isOpen, demo: c.demo, market: c.market, currency: c.currency, tradable: c.tradable,
  };
}

/** 美元兌台幣匯率（1 USD = ? TWD） */
export async function fetchUsdTwd(): Promise<{ rate: number; demo: boolean }> {
  try {
    const c = await fetchYahoo('TWD=X', '1d');
    if (c.price > 10 && c.price < 60) return { rate: c.price, demo: false };
  } catch { /* fallthrough */ }
  return { rate: 32, demo: true };
}

/** 取得 K 線，對於 1d 之外的區間仍會由 cache 補上 */
export function cachedQuote(symbol: string): Quote | undefined {
  const c = cache.get(`${symbol}|1d`);
  if (!c) return undefined;
  const change = c.price - c.prevClose;
  return {
    symbol: c.symbol, name: c.name, price: c.price, prevClose: c.prevClose, change,
    changePct: c.prevClose ? (change / c.prevClose) * 100 : 0, isOpen: c.isOpen, demo: c.demo,
    market: c.market, currency: c.currency, tradable: c.tradable,
  };
}
