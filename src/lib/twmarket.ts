// 台股全市場當日成交資料（證交所 + 櫃買中心）與產業分類（FinMind，備援：證交所月營收表的產業別）
import { getJSON } from './http';
import { store } from './store';

export interface TwQuote {
  code: string;
  symbol: string; // 2330.TW / 6488.TWO
  name: string;
  market: 'twse' | 'tpex';
  close: number;
  change: number;
  changePct: number;
  volume: number; // 股
  value: number; // 元
}

export interface SectorRow {
  name: string;
  value: number;
  volume: number;
  count: number;
  up: number;
  down: number;
  /** 依成交金額加權的平均漲跌幅 */
  changePct: number;
  share: number; // 佔全市場成交金額比例
  stocks: TwQuote[]; // 依成交金額排序
}

const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/[,+\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/** 民國日期 1151110 → 2026-11-10 */
export function rocDate(s: string) {
  const m = /^(\d{3})(\d{2})(\d{2})$/.exec(String(s || ''));
  return m ? `${+m[1] + 1911}-${m[2]}-${m[3]}` : '';
}

/** 解析證交所 STOCK_DAY_ALL（只取 4 碼普通股） */
export function parseTwse(rows: any[]): TwQuote[] {
  const out: TwQuote[] = [];
  for (const r of rows || []) {
    if (!/^\d{4}$/.test(r.Code)) continue;
    const close = num(r.ClosingPrice);
    const change = num(r.Change);
    const value = num(r.TradeValue);
    if (!close || !value) continue;
    const prev = close - change;
    out.push({
      code: r.Code, symbol: `${r.Code}.TW`, name: String(r.Name || '').trim(), market: 'twse',
      close, change, changePct: prev > 0 ? (change / prev) * 100 : 0, volume: num(r.TradeVolume), value,
    });
  }
  return out;
}

/** 解析櫃買中心每日收盤行情（Change 如 "+0.16"、"-0.37 "） */
export function parseTpex(rows: any[]): TwQuote[] {
  const out: TwQuote[] = [];
  for (const r of rows || []) {
    const code = r.SecuritiesCompanyCode;
    if (!/^\d{4}$/.test(code)) continue;
    const close = num(r.Close);
    const change = num(r.Change);
    const value = num(r.TransactionAmount);
    if (!close || !value) continue;
    const prev = close - change;
    out.push({
      code, symbol: `${code}.TWO`, name: String(r.CompanyName || '').trim(), market: 'tpex',
      close, change, changePct: prev > 0 ? (change / prev) * 100 : 0, volume: num(r.TradingShares), value,
    });
  }
  return out;
}

// FinMind 產業分類：同一檔可能有「電子工業」這種大類，優先取細分類
const BROAD = new Set(['電子工業', '所有證券', '大盤', 'Index', 'ETF', '上櫃ETF', '上櫃指數股票型基金(ETF)', 'ETN', '指數投資證券(ETN)', '受益證券', '存託憑證', '創新板股票', '創新版股票', '化學生技醫療']);
const ALIAS: Record<string, string> = {
  其他電子類: '其他電子業', 電子通路類: '電子通路業', 數位雲端類: '數位雲端', 居家生活類: '居家生活',
  運動休閒類: '運動休閒', 綠能環保類: '綠能環保', 觀光事業: '觀光餐旅', 金融業: '金融保險', 農業科技業: '農業科技',
};
export function parseIndustry(rows: any[]): Record<string, string> {
  const best: Record<string, { cat: string; date: string }> = {};
  for (const r of rows || []) {
    const id = r.stock_id, cat0 = r.industry_category;
    if (!id || !cat0) continue;
    const cat = ALIAS[cat0] || cat0;
    const cur = best[id];
    const specific = !BROAD.has(cat);
    if (!cur) { best[id] = { cat, date: r.date || '' }; continue; }
    const curSpecific = !BROAD.has(cur.cat);
    if ((specific && !curSpecific) || (specific === curSpecific && (r.date || '') > cur.date)) best[id] = { cat, date: r.date || '' };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(best)) out[k] = v.cat;
  return out;
}

export function aggregateSectors(quotes: TwQuote[], industry: Record<string, string>): SectorRow[] {
  const total = quotes.reduce((a, q) => a + q.value, 0) || 1;
  const map = new Map<string, SectorRow>();
  for (const q of quotes) {
    const name = industry[q.code];
    if (!name || BROAD.has(name)) continue;
    let s = map.get(name);
    if (!s) { s = { name, value: 0, volume: 0, count: 0, up: 0, down: 0, changePct: 0, share: 0, stocks: [] }; map.set(name, s); }
    s.value += q.value;
    s.volume += q.volume;
    s.count++;
    if (q.change > 0) s.up++;
    else if (q.change < 0) s.down++;
    s.changePct += q.changePct * q.value;
    s.stocks.push(q);
  }
  const rows = [...map.values()];
  for (const s of rows) {
    s.changePct = s.value ? s.changePct / s.value : 0;
    s.share = s.value / total;
    s.stocks.sort((a, b) => b.value - a.value);
  }
  return rows.sort((a, b) => b.value - a.value);
}

// ---------------- 載入與快取 ----------------
interface TwSnapshot { date: string; quotes: TwQuote[]; industry: Record<string, string>; fetchedAt: number }
let snap: TwSnapshot | null = null;
let loading: Promise<TwSnapshot> | null = null;
const IND_KEY = 'stocksim.industry.v1';

export function finmindHeaders(): Record<string, string> | undefined {
  const t = store.get().settings.finmindToken?.trim();
  return t ? { Authorization: `Bearer ${t}` } : undefined;
}

async function loadIndustry(): Promise<Record<string, string>> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const c = JSON.parse(localStorage.getItem(IND_KEY) || 'null');
    if (c?.date === today && c.map) return c.map;
  } catch { /* ignore */ }
  let map: Record<string, string> = {};
  try {
    const d = await getJSON<any>('https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo', finmindHeaders());
    map = parseIndustry(d?.data || []);
  } catch { /* fallback below */ }
  if (Object.keys(map).length < 500) {
    try {
      // 備援：證交所月營收彙總表含「產業別」（僅上市）
      const rows = await getJSON<any[]>('https://openapi.twse.com.tw/v1/opendata/t187ap05_L');
      for (const r of rows) if (r['公司代號'] && r['產業別']) map[r['公司代號']] = ALIAS[r['產業別']] || r['產業別'];
    } catch { /* ignore */ }
  }
  if (Object.keys(map).length > 500) localStorage.setItem(IND_KEY, JSON.stringify({ date: today, map }));
  else {
    try { const c = JSON.parse(localStorage.getItem(IND_KEY) || 'null'); if (c?.map) return c.map; } catch { /* ignore */ }
  }
  return map;
}

export function loadTwSnapshot(force = false): Promise<TwSnapshot> {
  if (!force && snap && Date.now() - snap.fetchedAt < 10 * 60_000) return Promise.resolve(snap);
  if (loading) return loading;
  loading = (async () => {
    const [twse, tpex, industry] = await Promise.all([
      getJSON<any[]>('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL').catch(() => []),
      getJSON<any[]>('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes').catch(() => []),
      loadIndustry(),
    ]);
    const quotes = [...parseTwse(twse), ...parseTpex(tpex)];
    if (!quotes.length) throw new Error('無法取得台股成交資料（請確認網路連線）');
    const date = rocDate(twse?.[0]?.Date || tpex?.[0]?.Date);
    snap = { date, quotes, industry, fetchedAt: Date.now() };
    return snap;
  })().finally(() => { loading = null; });
  return loading;
}

export function twQuoteOf(code: string): TwQuote | undefined {
  return snap?.quotes.find((q) => q.code === code);
}
export function industryOf(code: string): string | undefined {
  return snap?.industry[code];
}
