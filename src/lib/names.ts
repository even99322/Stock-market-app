import { getJSON } from './http';
import type { Market } from './types';

export interface SymbolInfo {
  symbol: string;
  name: string;
  market: Market;
  kind?: 'stock' | 'etf' | 'index';
}

// 內建常用標的（離線時也能搜尋，台股顯示中文名）
const BUILTIN_RAW: [string, string, Market, SymbolInfo['kind']?][] = [
  ['^TWII', '台灣加權指數', 'TW', 'index'],
  ['2330.TW', '台積電', 'TW'], ['2317.TW', '鴻海', 'TW'], ['2454.TW', '聯發科', 'TW'],
  ['2308.TW', '台達電', 'TW'], ['2382.TW', '廣達', 'TW'], ['2412.TW', '中華電', 'TW'],
  ['2881.TW', '富邦金', 'TW'], ['2882.TW', '國泰金', 'TW'], ['2891.TW', '中信金', 'TW'],
  ['2886.TW', '兆豐金', 'TW'], ['2884.TW', '玉山金', 'TW'], ['2892.TW', '第一金', 'TW'],
  ['5880.TW', '合庫金', 'TW'], ['2303.TW', '聯電', 'TW'], ['3711.TW', '日月光投控', 'TW'],
  ['2002.TW', '中鋼', 'TW'], ['1301.TW', '台塑', 'TW'], ['1303.TW', '南亞', 'TW'],
  ['6505.TW', '台塑化', 'TW'], ['2603.TW', '長榮', 'TW'], ['2609.TW', '陽明', 'TW'],
  ['2615.TW', '萬海', 'TW'], ['3008.TW', '大立光', 'TW'], ['2357.TW', '華碩', 'TW'],
  ['2379.TW', '瑞昱', 'TW'], ['3034.TW', '聯詠', 'TW'], ['2345.TW', '智邦', 'TW'],
  ['2207.TW', '和泰車', 'TW'], ['1216.TW', '統一', 'TW'], ['2912.TW', '統一超', 'TW'],
  ['3231.TW', '緯創', 'TW'], ['2356.TW', '英業達', 'TW'], ['2376.TW', '技嘉', 'TW'],
  ['3661.TW', '世芯-KY', 'TW'], ['2395.TW', '研華', 'TW'],
  ['0050.TW', '元大台灣50', 'TW', 'etf'], ['0056.TW', '元大高股息', 'TW', 'etf'],
  ['006208.TW', '富邦台50', 'TW', 'etf'], ['00878.TW', '國泰永續高股息', 'TW', 'etf'],
  ['00919.TW', '群益台灣精選高息', 'TW', 'etf'],
  ['6488.TWO', '環球晶', 'TW'], ['5347.TWO', '世界', 'TW'], ['3293.TWO', '鈊象', 'TW'],
  ['8299.TWO', '群聯', 'TW'], ['5483.TWO', '中美晶', 'TW'],
  ['^GSPC', 'S&P 500 指數', 'US', 'index'], ['^IXIC', '那斯達克綜合指數', 'US', 'index'],
  ['^DJI', '道瓊工業指數', 'US', 'index'],
  ['AAPL', 'Apple 蘋果', 'US'], ['MSFT', 'Microsoft 微軟', 'US'], ['NVDA', 'NVIDIA 輝達', 'US'],
  ['GOOGL', 'Alphabet (Google)', 'US'], ['AMZN', 'Amazon 亞馬遜', 'US'], ['META', 'Meta Platforms', 'US'],
  ['TSLA', 'Tesla 特斯拉', 'US'], ['TSM', '台積電 ADR', 'US'], ['AMD', 'AMD 超微', 'US'],
  ['AVGO', 'Broadcom 博通', 'US'], ['NFLX', 'Netflix', 'US'], ['JPM', 'JPMorgan 摩根大通', 'US'],
  ['KO', 'Coca-Cola 可口可樂', 'US'], ['BRK-B', 'Berkshire 波克夏 B', 'US'], ['V', 'Visa', 'US'],
  ['COST', 'Costco 好市多', 'US'], ['DIS', 'Disney 迪士尼', 'US'],
  ['^SOX', '費城半導體指數', 'US', 'index'], ['^VIX', 'VIX 恐慌指數', 'US', 'index'],
  ['^TNX', '美國10年期公債殖利率', 'US', 'index'], ['DX-Y.NYB', '美元指數', 'US', 'index'],
  ['TWD=X', '美元/台幣', 'US', 'index'], ['JPY=X', '美元/日圓', 'US', 'index'],
  ['ES=F', 'S&P 500 期貨', 'US', 'index'], ['NQ=F', '那斯達克100 期貨', 'US', 'index'], ['YM=F', '道瓊期貨', 'US', 'index'],
  ['GC=F', '黃金期貨', 'US', 'index'], ['CL=F', '原油期貨', 'US', 'index'],
  ['^N225', '日經225 指數', 'US', 'index'], ['^HSI', '恆生指數', 'US', 'index'],
  ['SOXX', 'iShares 半導體 ETF', 'US', 'etf'], ['EWT', 'iShares MSCI 台灣 ETF', 'US', 'etf'],
  ['UMC', '聯電 ADR', 'US'], ['ASX', '日月光 ADR', 'US'], ['CHT', '中華電 ADR', 'US'],
  ['SPY', 'SPDR 標普500 ETF', 'US', 'etf'], ['VOO', 'Vanguard 標普500 ETF', 'US', 'etf'],
  ['QQQ', 'Invesco 那斯達克100 ETF', 'US', 'etf'], ['VTI', 'Vanguard 全美股市 ETF', 'US', 'etf'],
  ['VT', 'Vanguard 全世界股票 ETF', 'US', 'etf'],
];

export const BUILTIN: SymbolInfo[] = BUILTIN_RAW.map(([symbol, name, market, kind]) => ({
  symbol, name, market, kind: kind || 'stock',
}));

// ---------- 台股完整清單（證交所 / 櫃買中心 OpenAPI，每日快取一次） ----------
const LIST_KEY = 'stocksim.twlist';
const FUND_KEY = 'stocksim.twfund';
let twList: SymbolInfo[] = [];
let twFund: Record<string, Fundamental> = {};

export interface Fundamental {
  pe?: number;
  dividendYield?: number;
  pb?: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const pick = (o: any, keys: string[]) => {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k];
  return undefined;
};
const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n !== 0 ? n : undefined;
};

function loadCache() {
  try {
    const l = JSON.parse(localStorage.getItem(LIST_KEY) || 'null');
    if (l?.list) twList = l.list;
    const f = JSON.parse(localStorage.getItem(FUND_KEY) || 'null');
    if (f?.data) twFund = f.data;
    return { listDate: l?.date as string | undefined, fundDate: f?.date as string | undefined };
  } catch {
    return {};
  }
}

let loading: Promise<void> | null = null;
export function loadTwData(force = false): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { listDate, fundDate } = loadCache();
    if (force || listDate !== today()) {
      const list: SymbolInfo[] = [];
      try {
        const twse = await getJSON<any[]>('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
        for (const r of twse) {
          const code = pick(r, ['Code', '證券代號']);
          const name = pick(r, ['Name', '證券名稱']);
          if (code && name) list.push({ symbol: `${code}.TW`, name, market: 'TW', kind: /^00/.test(code) ? 'etf' : 'stock' });
        }
      } catch { /* 離線時保留舊快取 */ }
      try {
        const tpex = await getJSON<any[]>('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
        for (const r of tpex) {
          const code = pick(r, ['SecuritiesCompanyCode', 'Code', '代號']);
          const name = pick(r, ['CompanyName', 'Name', '名稱']);
          if (code && name && /^\d{4,6}[A-Z]?$/.test(code)) list.push({ symbol: `${code}.TWO`, name, market: 'TW', kind: /^00/.test(code) ? 'etf' : 'stock' });
        }
      } catch { /* ignore */ }
      if (list.length > 100) {
        twList = list;
        localStorage.setItem(LIST_KEY, JSON.stringify({ date: today(), list }));
      }
    }
    if (force || fundDate !== today()) {
      const data: Record<string, Fundamental> = {};
      try {
        const rows = await getJSON<any[]>('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL');
        for (const r of rows) {
          const code = pick(r, ['Code']);
          if (code) data[`${code}.TW`] = { pe: num(r.PEratio), dividendYield: num(r.DividendYield), pb: num(r.PBratio) };
        }
      } catch { /* ignore */ }
      try {
        const rows = await getJSON<any[]>('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis');
        for (const r of rows) {
          const code = pick(r, ['SecuritiesCompanyCode', 'Code']);
          if (code)
            data[`${code}.TWO`] = {
              pe: num(pick(r, ['PriceEarningRatio', 'PEratio', 'PERatio'])),
              dividendYield: num(pick(r, ['YieldRatio', 'DividendYield'])),
              pb: num(pick(r, ['PriceBookRatio', 'PBratio', 'PBRatio'])),
            };
        }
      } catch { /* ignore */ }
      if (Object.keys(data).length > 100) {
        twFund = data;
        localStorage.setItem(FUND_KEY, JSON.stringify({ date: today(), data }));
      }
    }
  })().finally(() => { loading = null; });
  return loading;
}
loadCache();

export function getFundamental(symbol: string): Fundamental | undefined {
  return twFund[symbol];
}

export function lookupName(symbol: string): string | undefined {
  return BUILTIN.find((s) => s.symbol === symbol)?.name || twList.find((s) => s.symbol === symbol)?.name;
}

export function marketOf(symbol: string): Market {
  if (/\.(TW|TWO)$/i.test(symbol) || symbol === '^TWII' || symbol === '^TWOII') return 'TW';
  return 'US';
}

/** 指數、匯率、期貨等不能在模擬帳戶交易、也沒有財報的標的 */
export function isIndex(symbol: string) {
  return symbol.startsWith('^') || symbol.includes('=') || symbol.endsWith('.NYB');
}

/** 使用者輸入轉成 Yahoo 代號：2330 → 2330.TW、aapl → AAPL */
export function normalizeSymbol(input: string): string {
  const s = input.trim().toUpperCase();
  if (!s) return s;
  if (/^\d{4,6}[A-Z]?$/.test(s)) {
    const hit = [...BUILTIN, ...twList].find((x) => x.symbol.split('.')[0] === s);
    return hit ? hit.symbol : `${s}.TW`;
  }
  if (/\.(TW|TWO)$/.test(s) || s.startsWith('^') || s.includes('=') || s.endsWith('.NYB')) return s;
  return s.replace(/\s+/g, '').replace(/\./g, '-'); // BRK.B → BRK-B
}

/** 本機搜尋：代號前綴或名稱包含 */
export function localSearch(q: string, limit = 12): SymbolInfo[] {
  const s = q.trim().toUpperCase();
  if (!s) return [];
  const seen = new Set<string>();
  const out: SymbolInfo[] = [];
  const add = (x: SymbolInfo) => {
    if (!seen.has(x.symbol) && out.length < limit) { seen.add(x.symbol); out.push(x); }
  };
  const all = [...BUILTIN, ...twList];
  for (const x of all) if (x.symbol.split('.')[0] === s) add(x);
  for (const x of all) if (x.symbol.toUpperCase().startsWith(s)) add(x);
  for (const x of all) if (x.name.toUpperCase().includes(s)) add(x);
  return out;
}

/** 線上搜尋（Yahoo），主要用於美股 */
export async function remoteSearch(q: string): Promise<SymbolInfo[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`;
  const data = await getJSON<any>(url);
  const out: SymbolInfo[] = [];
  for (const r of data?.quotes || []) {
    if (!r.symbol || !['EQUITY', 'ETF', 'INDEX'].includes(r.quoteType)) continue;
    const sym: string = r.symbol;
    const mk = marketOf(sym);
    // 只收台股和美股（美股代號沒有 . 後綴，或為 BRK-B 這種）
    if (mk === 'US' && /\.[A-Z]+$/.test(sym)) continue;
    out.push({
      symbol: sym,
      name: lookupName(sym) || r.shortname || r.longname || sym,
      market: mk,
      kind: r.quoteType === 'ETF' ? 'etf' : r.quoteType === 'INDEX' ? 'index' : 'stock',
    });
  }
  return out;
}
