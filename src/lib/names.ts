import { getJSON } from './http';
import type { InstKind, Market } from './types';

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
  ['^KS11', '韓國 KOSPI 指數', 'US', 'index'], ['000001.SS', '上證綜合指數', 'US', 'index'],
  ['^GDAXI', '德國 DAX 指數', 'US', 'index'], ['^FTSE', '英國富時100 指數', 'US', 'index'], ['^RUT', '羅素2000 指數', 'US', 'index'],
  ['TX.TAIFEX', '台指期（近月・日盤）', 'TW', 'index'], ['TXN.TAIFEX', '台指期（近月・夜盤）', 'TW', 'index'],
  ['JPYTWD=X', '日圓/台幣', 'US', 'index'], ['EURTWD=X', '歐元/台幣', 'US', 'index'], ['HKDTWD=X', '港幣/台幣', 'US', 'index'],
  ['CNY=X', '美元/人民幣', 'US', 'index'], ['EURUSD=X', '歐元/美元', 'US', 'index'], ['KRW=X', '美元/韓元', 'US', 'index'],
  ['^IRX', '美國3個月期國庫券殖利率', 'US', 'index'], ['^FVX', '美國5年期公債殖利率', 'US', 'index'], ['^TYX', '美國30年期公債殖利率', 'US', 'index'],
  ['RTY=F', '羅素2000 期貨', 'US', 'index'], ['NKD=F', '日經225 期貨', 'US', 'index'],
  ['SI=F', '白銀期貨', 'US', 'index'], ['HG=F', '銅期貨', 'US', 'index'], ['BZ=F', '布蘭特原油期貨', 'US', 'index'],
  ['NG=F', '天然氣期貨', 'US', 'index'], ['ZC=F', '玉米期貨', 'US', 'index'], ['ZS=F', '黃豆期貨', 'US', 'index'],
  ['BTC-USD', '比特幣', 'US', 'index'], ['ETH-USD', '以太幣', 'US', 'index'],
  ['^KQ11', '韓國 KOSDAQ 指數', 'US', 'index'], ['^HSCE', '恆生國企指數', 'US', 'index'], ['399001.SZ', '深證成指', 'US', 'index'],
  ['^NSEI', '印度 NIFTY 50', 'US', 'index'], ['^BSESN', '印度 SENSEX', 'US', 'index'], ['^AXJO', '澳洲 ASX 200', 'US', 'index'],
  ['^NZ50', '紐西蘭 NZX 50', 'US', 'index'], ['^STI', '新加坡海峽時報指數', 'US', 'index'], ['^JKSE', '印尼雅加達綜合指數', 'US', 'index'],
  ['^KLSE', '馬來西亞 KLCI', 'US', 'index'], ['VNM', '越南 ETF（VanEck）', 'US', 'etf'],
  ['^STOXX50E', '歐元區 STOXX 50', 'US', 'index'], ['^STOXX', '歐洲 STOXX 600', 'US', 'index'], ['^FCHI', '法國 CAC 40', 'US', 'index'],
  ['^SSMI', '瑞士 SMI', 'US', 'index'], ['FTSEMIB.MI', '義大利 FTSE MIB', 'US', 'index'], ['^IBEX', '西班牙 IBEX 35', 'US', 'index'],
  ['^AEX', '荷蘭 AEX', 'US', 'index'], ['^OMX', '瑞典 OMX 30', 'US', 'index'], ['^BFX', '比利時 BEL 20', 'US', 'index'], ['^ATX', '奧地利 ATX', 'US', 'index'],
  ['^GSPTSE', '加拿大 TSX 綜合指數', 'US', 'index'], ['^BVSP', '巴西 IBOVESPA', 'US', 'index'], ['^MXX', '墨西哥 IPC', 'US', 'index'],
  ['^TA125.TA', '以色列 TA-125', 'US', 'index'], ['^J203.JO', '南非全股指數', 'US', 'index'], ['XU100.IS', '土耳其 BIST 100', 'US', 'index'],
  ['GBPTWD=X', '英鎊/台幣', 'US', 'index'], ['AUDTWD=X', '澳幣/台幣', 'US', 'index'], ['CADTWD=X', '加幣/台幣', 'US', 'index'],
  ['SGDTWD=X', '新加坡幣/台幣', 'US', 'index'], ['KRWTWD=X', '韓元/台幣', 'US', 'index'], ['THBTWD=X', '泰銖/台幣', 'US', 'index'],
  ['CHFTWD=X', '瑞士法郎/台幣', 'US', 'index'], ['NZDTWD=X', '紐幣/台幣', 'US', 'index'], ['TWDCNY=X', '台幣/人民幣', 'US', 'index'],
  ['GBPUSD=X', '英鎊/美元', 'US', 'index'], ['AUDUSD=X', '澳幣/美元', 'US', 'index'], ['NZDUSD=X', '紐幣/美元', 'US', 'index'],
  ['CAD=X', '美元/加幣', 'US', 'index'], ['CHF=X', '美元/瑞士法郎', 'US', 'index'], ['HKD=X', '美元/港幣', 'US', 'index'],
  ['SGD=X', '美元/新加坡幣', 'US', 'index'], ['INR=X', '美元/印度盧比', 'US', 'index'], ['THB=X', '美元/泰銖', 'US', 'index'],
  ['VND=X', '美元/越南盾', 'US', 'index'], ['IDR=X', '美元/印尼盾', 'US', 'index'], ['MYR=X', '美元/馬來西亞令吉', 'US', 'index'],
  ['PHP=X', '美元/菲律賓披索', 'US', 'index'], ['MXN=X', '美元/墨西哥披索', 'US', 'index'], ['BRL=X', '美元/巴西雷亞爾', 'US', 'index'],
  ['ZAR=X', '美元/南非蘭特', 'US', 'index'], ['TRY=X', '美元/土耳其里拉', 'US', 'index'], ['EURJPY=X', '歐元/日圓', 'US', 'index'],
  ['7203.T', '豐田汽車', 'US'], ['6758.T', '索尼', 'US'], ['8035.T', '東京威力科創', 'US'], ['9984.T', '軟銀集團', 'US'],
  ['9983.T', '迅銷（UNIQLO）', 'US'], ['6861.T', '基恩斯', 'US'], ['7974.T', '任天堂', 'US'],
  ['005930.KS', '三星電子', 'US'], ['000660.KS', 'SK 海力士', 'US'], ['373220.KS', 'LG 新能源', 'US'],
  ['0700.HK', '騰訊控股', 'US'], ['9988.HK', '阿里巴巴', 'US'], ['1810.HK', '小米集團', 'US'], ['3690.HK', '美團', 'US'],
  ['0005.HK', '匯豐控股', 'US'], ['1299.HK', '友邦保險', 'US'],
  ['600519.SS', '貴州茅台', 'US'], ['300750.SZ', '寧德時代', 'US'], ['002594.SZ', '比亞迪', 'US'], ['601318.SS', '中國平安', 'US'],
  ['ASML.AS', 'ASML 艾司摩爾', 'US'], ['SAP.DE', 'SAP 思愛普', 'US'], ['SIE.DE', '西門子', 'US'], ['MC.PA', 'LVMH', 'US'], ['OR.PA', '萊雅', 'US'],
  ['NESN.SW', '雀巢', 'US'], ['NOVN.SW', '諾華', 'US'], ['NOVO-B.CO', '諾和諾德', 'US'], ['SHEL.L', '殼牌', 'US'], ['AZN.L', '阿斯特捷利康', 'US'],
  ['RELIANCE.NS', '信實工業', 'US'], ['TCS.NS', '塔塔顧問服務', 'US'], ['BHP.AX', '必和必拓', 'US'], ['CBA.AX', '澳洲聯邦銀行', 'US'],
  ['D05.SI', '星展集團', 'US'], ['SHOP.TO', 'Shopify', 'US'], ['RY.TO', '加拿大皇家銀行', 'US'],
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
  if (/\.(TW|TWO|TAIFEX)$/i.test(symbol) || symbol === '^TWII' || symbol === '^TWOII') return 'TW';
  return 'US';
}

/** 海外交易所（Yahoo 代號後綴）：標籤、地區、當地大盤與匯率 */
export const EXCHANGES: Record<string, { tag: string; region: string; index: string; fx: string }> = {
  T: { tag: '日', region: '日本', index: '^N225', fx: 'JPYTWD=X' },
  KS: { tag: '韓', region: '韓國', index: '^KS11', fx: 'KRWTWD=X' }, KQ: { tag: '韓', region: '韓國', index: '^KQ11', fx: 'KRWTWD=X' },
  HK: { tag: '港', region: '香港', index: '^HSI', fx: 'HKDTWD=X' },
  SS: { tag: '中', region: '中國（上海）', index: '000001.SS', fx: 'CNY=X' }, SZ: { tag: '中', region: '中國（深圳）', index: '399001.SZ', fx: 'CNY=X' },
  L: { tag: '英', region: '英國', index: '^FTSE', fx: 'GBPTWD=X' },
  DE: { tag: '德', region: '德國', index: '^GDAXI', fx: 'EURTWD=X' }, F: { tag: '德', region: '德國', index: '^GDAXI', fx: 'EURTWD=X' },
  PA: { tag: '法', region: '法國', index: '^FCHI', fx: 'EURTWD=X' }, AS: { tag: '荷', region: '荷蘭', index: '^AEX', fx: 'EURTWD=X' },
  MI: { tag: '義', region: '義大利', index: 'FTSEMIB.MI', fx: 'EURTWD=X' }, MC: { tag: '西', region: '西班牙', index: '^IBEX', fx: 'EURTWD=X' },
  BR: { tag: '比', region: '比利時', index: '^BFX', fx: 'EURTWD=X' }, VI: { tag: '奧', region: '奧地利', index: '^ATX', fx: 'EURTWD=X' },
  SW: { tag: '瑞', region: '瑞士', index: '^SSMI', fx: 'CHFTWD=X' }, ST: { tag: '典', region: '瑞典', index: '^OMX', fx: 'EURTWD=X' },
  CO: { tag: '丹', region: '丹麥', index: '^STOXX', fx: 'EURTWD=X' }, HE: { tag: '芬', region: '芬蘭', index: '^STOXX', fx: 'EURTWD=X' }, OL: { tag: '挪', region: '挪威', index: '^STOXX', fx: 'EURTWD=X' },
  NS: { tag: '印', region: '印度', index: '^NSEI', fx: 'INR=X' }, BO: { tag: '印', region: '印度', index: '^BSESN', fx: 'INR=X' },
  AX: { tag: '澳', region: '澳洲', index: '^AXJO', fx: 'AUDTWD=X' }, NZ: { tag: '紐', region: '紐西蘭', index: '^NZ50', fx: 'NZDTWD=X' },
  SI: { tag: '星', region: '新加坡', index: '^STI', fx: 'SGDTWD=X' }, JK: { tag: '尼', region: '印尼', index: '^JKSE', fx: 'IDR=X' },
  KL: { tag: '馬', region: '馬來西亞', index: '^KLSE', fx: 'MYR=X' }, BK: { tag: '泰', region: '泰國', index: '^N225', fx: 'THBTWD=X' },
  TO: { tag: '加', region: '加拿大', index: '^GSPTSE', fx: 'CADTWD=X' }, V: { tag: '加', region: '加拿大', index: '^GSPTSE', fx: 'CADTWD=X' },
  SA: { tag: '巴', region: '巴西', index: '^BVSP', fx: 'BRL=X' }, MX: { tag: '墨', region: '墨西哥', index: '^MXX', fx: 'MXN=X' },
  TA: { tag: '以', region: '以色列', index: '^TA125.TA', fx: 'TWD=X' }, JO: { tag: '非', region: '南非', index: '^J203.JO', fx: 'ZAR=X' },
  IS: { tag: '土', region: '土耳其', index: 'XU100.IS', fx: 'TRY=X' },
};
const FOREIGN_RE = new RegExp(`\\.(${Object.keys(EXCHANGES).join('|')})$`);
/** 台股、美股以外的海外交易所代號（7203.T、0700.HK、ASML.AS…） */
export const exchangeOf = (symbol: string) => EXCHANGES[symbol.match(FOREIGN_RE)?.[1] || ''];
export const isForeign = (symbol: string) => FOREIGN_RE.test(symbol);
/** 搜尋結果與清單用的市場標籤 */
export function marketTag(symbol: string): string {
  if (marketOf(symbol) === 'TW') return '台';
  if (/=X$/.test(symbol)) return '匯';
  if (/=F$/.test(symbol)) return '期';
  return exchangeOf(symbol)?.tag || (symbol.startsWith('^') ? '指' : '美');
}

/** 指數、匯率、期貨、海外股票等不能在模擬帳戶交易、也沒有財報分析的標的 */
export function isIndex(symbol: string) {
  return symbol.startsWith('^') || symbol.includes('=') || /\.(NYB|TAIFEX)$/.test(symbol) || /-USD$/.test(symbol) || isForeign(symbol);
}

const RATES = new Set(['^TNX', '^IRX', '^FVX', '^TYX']);
/** 依代號判斷種類（Yahoo 的 instrumentType 可用時優先） */
export function kindOf(symbol: string, instrumentType?: string): InstKind {
  if (RATES.has(symbol)) return 'rate';
  if (/\.TAIFEX$/.test(symbol) || /=F$/.test(symbol) || instrumentType === 'FUTURE') return 'future';
  if (/=X$/.test(symbol) || instrumentType === 'CURRENCY') return 'fx';
  if (/-USD$/.test(symbol) || instrumentType === 'CRYPTOCURRENCY') return 'crypto';
  if (symbol.startsWith('^') || /\.NYB$/.test(symbol) || instrumentType === 'INDEX' || BUILTIN.some((b) => b.symbol === symbol && b.kind === 'index')) return 'index';
  return 'stock';
}

/** 價格小數位數：匯率依數值大小，其餘採 Yahoo 的 priceHint（上限 4） */
export function digitsOf(kind: InstKind, price: number, priceHint?: number): number | undefined {
  if (kind === 'fx') return price >= 100 ? 2 : price >= 10 ? 3 : 4;
  if (kind === 'rate') return 3;
  if (kind === 'stock') return priceHint === -1 ? (price >= 1000 ? 0 : 2) : undefined; // -1：海外股票
  if (kind === 'future' || kind === 'crypto') return price >= 1000 ? Math.min(priceHint ?? 2, 2) : Math.min(Math.max(priceHint ?? 2, 2), 3);
  return undefined;
}

/** 使用者輸入轉成 Yahoo 代號：2330 → 2330.TW、aapl → AAPL */
export function normalizeSymbol(input: string): string {
  const s = input.trim().toUpperCase();
  if (!s) return s;
  if (/^\d{4,6}[A-Z]?$/.test(s)) {
    const hit = [...BUILTIN, ...twList].find((x) => x.symbol.split('.')[0] === s);
    return hit ? hit.symbol : `${s}.TW`;
  }
  if (/\.(TW|TWO|TAIFEX)$/.test(s) || s.startsWith('^') || s.includes('=') || s.endsWith('.NYB') || /-USD$/.test(s) || isForeign(s)) return s;
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
    // 台股、美股，以及認得的海外交易所（日、韓、港、中、歐…）；其餘後綴略過
    if (mk === 'US' && /\.[A-Z]+$/.test(sym) && !isForeign(sym)) continue;
    out.push({
      symbol: sym,
      name: lookupName(sym) || r.shortname || r.longname || sym,
      market: mk,
      kind: r.quoteType === 'ETF' ? 'etf' : r.quoteType === 'INDEX' ? 'index' : 'stock',
    });
  }
  return out;
}
