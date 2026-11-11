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
