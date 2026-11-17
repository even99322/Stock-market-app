// 台指期（期交所 OpenAPI 每日行情：近月合約的日盤與盤後）
import { getJSON } from './http';

export interface TxQuote { session: '日盤' | '夜盤'; month: string; date: string; last: number; change: number; pct: number; volume: number }

const n = (v: any) => {
  const x = parseFloat(String(v ?? '').replace(/[,%+\s]/g, ''));
  return Number.isFinite(x) ? x : NaN;
};

/** 取 TX（臺股期貨）最近月份合約（排除週合約與價差）的日盤、盤後各一筆 */
export function parseTaifex(rows: any[]): TxQuote[] {
  const tx = (rows || []).filter((r) => r?.Contract === 'TX' && /^\d{6}$/.test(String(r['ContractMonth(Week)'] || '')) && Number.isFinite(n(r.Last)));
  if (!tx.length) return [];
  const month = tx.map((r) => String(r['ContractMonth(Week)'])).sort()[0];
  const out: TxQuote[] = [];
  for (const sess of ['一般', '盤後'] as const) {
    const r = tx.find((x) => x['ContractMonth(Week)'] === month && x.TradingSession === sess);
    if (!r) continue;
    const d = String(r.Date || '');
    out.push({
      session: sess === '一般' ? '日盤' : '夜盤', month, date: d.length === 8 ? `${d.slice(4, 6)}/${d.slice(6)}` : '',
      last: n(r.Last), change: n(r.Change) || 0, pct: n(r['%']) || 0, volume: n(r.Volume) || 0,
    });
  }
  return out;
}

let cache: { at: number; data: TxQuote[] } | null = null;
export async function fetchTaifex(): Promise<TxQuote[]> {
  if (cache && Date.now() - cache.at < 15 * 60_000) return cache.data;
  const data = parseTaifex(await getJSON<any[]>('https://openapi.taifex.com.tw/v1/DailyMarketReportFut'));
  cache = { at: Date.now(), data };
  return data;
}

// ---------- 台指期歷史日 K（FinMind TaiwanFuturesDaily） ----------
import { finmindHeaders } from './twmarket';
import type { Bar, ChartData } from './types';

export const isTaifex = (symbol: string) => /\.TAIFEX$/.test(symbol);
const TX_NAME: Record<string, string> = { 'TX.TAIFEX': '台指期（近月・日盤）', 'TXN.TAIFEX': '台指期（近月・夜盤）' };

/**
 * 把期交所每日行情整理成「近月連續」日 K：每個交易日取成交量最大的月份合約
 * （結算日前後會自動換到次月）。session：position＝日盤、after_market＝夜盤。
 */
export function parseTxDaily(rows: any[], session: 'position' | 'after_market'): Bar[] {
  const best = new Map<string, any>();
  for (const r of rows || []) {
    if (r?.trading_session !== session || !/^\d{6}$/.test(String(r.contract_date || ''))) continue;
    if (!(r.close > 0) || !(r.open > 0)) continue;
    const cur = best.get(r.date);
    if (!cur || r.volume > cur.volume) best.set(r.date, r);
  }
  return [...best.keys()].sort().map((d) => {
    const r = best.get(d);
    // 以台灣時間 09:00 當作該日 K 線的時間（和 Yahoo 的台股日 K 一致）
    return { time: Date.parse(d + 'T01:00:00Z') / 1000, open: r.open, high: r.max, low: r.min, close: r.close, volume: r.volume || 0 };
  });
}

let txCache: { at: number; rows: any[] } | null = null;
async function loadTxRows(): Promise<any[]> {
  if (txCache && Date.now() - txCache.at < 10 * 60_000) return txCache.rows;
  const start = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
  const d = await getJSON<any>(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanFuturesDaily&data_id=TX&start_date=${start}`, finmindHeaders());
  if (d?.status && d.status !== 200) throw new Error(`FinMind：${d.msg}`);
  txCache = { at: Date.now(), rows: d?.data || [] };
  return txCache.rows;
}

/** 台指期日 K（只有日線；1 日／5 日範圍回傳最近一根，用來顯示報價） */
export async function fetchTxChart(symbol: string, range: string): Promise<ChartData> {
  const all = parseTxDaily(await loadTxRows(), symbol === 'TXN.TAIFEX' ? 'after_market' : 'position');
  if (all.length < 2) throw new Error('期交所沒有回傳台指期資料');
  const n = range === '1d' ? 1 : range === '5d' ? 5 : range === '1mo' ? 22 : range === '6mo' ? 125 : all.length;
  const last = all[all.length - 1], prev = all[all.length - 2];
  const yr = all.slice(-250);
  return {
    kind: 'future', digits: 0, volUnit: '口',
    symbol, name: TX_NAME[symbol] || symbol, market: 'TW', currency: 'TWD',
    bars: all.slice(-n), price: last.close, prevClose: prev.close, gmtoffset: 28800,
    isOpen: false, intraday: false, demo: false, tradable: false, fetchedAt: Date.now(),
    high52: Math.max(...yr.map((b) => b.high)), low52: Math.min(...yr.map((b) => b.low)),
    exchangeName: '臺灣期貨交易所（每日行情，收盤後更新）',
  } as ChartData;
}
