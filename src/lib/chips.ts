// 籌碼面（台股）：三大法人買賣超、融資融券、外資持股比率、股利。資料來源 FinMind。
import { getJSON } from './http';
import { finmindHeaders } from './twmarket';

export interface InstDay { date: string; foreign: number; trust: number; dealer: number; total: number } // 單位：張
export interface MarginDay { date: string; margin: number; short: number } // 餘額，單位：張
export interface Chips { inst: InstDay[]; margin: MarginDay[]; foreignRatio: { date: string; ratio: number }[] }
export interface Dividend { period: string; cash: number; stock: number; exDate: string; payDate: string }

export function parseInst(rows: any[]): InstDay[] {
  const by: Record<string, InstDay> = {};
  for (const r of rows || []) {
    if (!r?.date || !r.name) continue;
    const d = (by[r.date] ||= { date: r.date, foreign: 0, trust: 0, dealer: 0, total: 0 });
    const net = ((r.buy || 0) - (r.sell || 0)) / 1000;
    if (/^Foreign/.test(r.name)) d.foreign += net;
    else if (r.name === 'Investment_Trust') d.trust += net;
    else if (/^Dealer/.test(r.name)) d.dealer += net;
    else continue;
    d.total += net;
  }
  return Object.values(by).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function parseMargin(rows: any[]): MarginDay[] {
  return (rows || [])
    .filter((r) => r?.date && r.MarginPurchaseTodayBalance != null)
    .map((r) => ({ date: r.date, margin: +r.MarginPurchaseTodayBalance || 0, short: +r.ShortSaleTodayBalance || 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function parseDividends(rows: any[]): Dividend[] {
  return (rows || [])
    .map((r) => ({
      period: String(r.year || ''),
      cash: (+r.CashEarningsDistribution || 0) + (+r.CashStatutorySurplus || 0),
      stock: (+r.StockEarningsDistribution || 0) + (+r.StockStatutorySurplus || 0),
      exDate: r.CashExDividendTradingDate || r.StockExDividendTradingDate || '',
      payDate: r.CashDividendPaymentDate || '',
    }))
    .filter((d) => d.cash > 0 || d.stock > 0)
    .sort((a, b) => ((a.exDate || '9999') < (b.exDate || '9999') ? 1 : -1));
}

/** 連續買超（正）或賣超（負）天數 */
export function streak(vals: number[]): number {
  let n = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i];
    if (v === 0) break;
    if (n === 0) n = v > 0 ? 1 : -1;
    else if (v > 0 === n > 0) n += n > 0 ? 1 : -1;
    else break;
  }
  return n;
}
const sumLast = (a: number[], k: number) => a.slice(-k).reduce((s, x) => s + x, 0);

export interface ChipInsight { tone: 'good' | 'bad' | 'neutral'; text: string }
/** closes：對應期間的收盤價（用來判斷融資與股價的關係），可省略 */
export function analyzeChips(c: Chips, priceChg20?: number): ChipInsight[] {
  const out: ChipInsight[] = [];
  const n = (x: number) => Math.round(Math.abs(x)).toLocaleString('zh-TW');
  if (c.inst.length) {
    const f = c.inst.map((d) => d.foreign), t = c.inst.map((d) => d.trust);
    const fs = streak(f), ts = streak(t);
    const f5 = sumLast(f, 5), f20 = sumLast(f, 20);
    out.push({
      tone: f5 > 0 ? 'good' : f5 < 0 ? 'bad' : 'neutral',
      text: `外資近 5 日${f5 >= 0 ? '買超' : '賣超'} ${n(f5)} 張、近 20 日${f20 >= 0 ? '買超' : '賣超'} ${n(f20)} 張${Math.abs(fs) >= 3 ? `，已連續 ${Math.abs(fs)} 天${fs > 0 ? '買超' : '賣超'}` : ''}。外資資金量最大，方向通常影響大型股走勢。`,
    });
    const t5 = sumLast(t, 5);
    if (t5 !== 0 || Math.abs(ts) >= 3) out.push({
      tone: t5 > 0 ? 'good' : t5 < 0 ? 'bad' : 'neutral',
      text: `投信近 5 日${t5 >= 0 ? '買超' : '賣超'} ${n(t5)} 張${Math.abs(ts) >= 3 ? `，連續 ${Math.abs(ts)} 天${ts > 0 ? '買超' : '賣超'}` : ''}。投信（基金、ETF）連續買超常見於季底作帳或 ETF 換股。`,
    });
    if (f5 > 0 && t5 > 0) out.push({ tone: 'good', text: '外資與投信同步買超（土洋合買），籌碼面偏多。' });
    if (f5 < 0 && t5 < 0) out.push({ tone: 'bad', text: '外資與投信同步賣超，籌碼面偏空。' });
  }
  if (c.margin.length >= 2) {
    const L = c.margin[c.margin.length - 1];
    const base = c.margin[Math.max(0, c.margin.length - 21)];
    const mChg = base.margin ? L.margin / base.margin - 1 : 0;
    let text = `融資餘額 ${L.margin.toLocaleString('zh-TW')} 張，近 20 日${mChg >= 0 ? '增加' : '減少'} ${(Math.abs(mChg) * 100).toFixed(1)}%。`;
    let tone: ChipInsight['tone'] = 'neutral';
    if (priceChg20 != null) {
      if (mChg > 0.1 && priceChg20 < -0.03) { text += '融資增加但股價下跌：散戶逢低攤平，若續跌可能出現斷頭賣壓。'; tone = 'bad'; }
      else if (mChg < -0.1 && priceChg20 > 0.03) { text += '股價上漲而融資減少：籌碼由散戶流向法人，結構較穩。'; tone = 'good'; }
      else if (mChg > 0.2 && priceChg20 > 0.1) { text += '股價與融資同步大增：散戶追價熱絡，短線過熱時要留意。'; }
    }
    out.push({ tone, text });
    const ratio = L.margin ? L.short / L.margin : 0;
    if (ratio > 0.3) out.push({ tone: 'neutral', text: `券資比 ${(ratio * 100).toFixed(0)}%，放空的人很多；若股價續漲，空單回補可能推升股價（軋空）。` });
  }
  if (c.foreignRatio.length >= 2) {
    const a = c.foreignRatio[0], b = c.foreignRatio[c.foreignRatio.length - 1];
    out.push({ tone: 'neutral', text: `外資持股比率 ${b.ratio.toFixed(2)}%，這段期間${b.ratio >= a.ratio ? '上升' : '下降'} ${Math.abs(b.ratio - a.ratio).toFixed(2)} 個百分點。` });
  }
  return out;
}

const cache = new Map<string, { at: number; data: any }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}
const fm = (ds: string, code: string, start: string) =>
  getJSON<any>(`https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${code}&start_date=${start}`, finmindHeaders());
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export function fetchChips(code: string): Promise<Chips> {
  return cached(`chips|${code}`, async () => {
    const start = daysAgo(95);
    const [a, b, c] = await Promise.all([
      fm('TaiwanStockInstitutionalInvestorsBuySell', code, start),
      fm('TaiwanStockMarginPurchaseShortSale', code, start).catch(() => ({ data: [] })),
      fm('TaiwanStockShareholding', code, start).catch(() => ({ data: [] })),
    ]);
    if (a?.status && a.status !== 200) throw new Error(`FinMind：${a.msg}`);
    const chips: Chips = {
      inst: parseInst(a?.data), margin: parseMargin(b?.data),
      foreignRatio: (c?.data || []).filter((r: any) => r.ForeignInvestmentSharesRatio != null).map((r: any) => ({ date: r.date, ratio: +r.ForeignInvestmentSharesRatio })),
    };
    if (!chips.inst.length) throw new Error('查無法人買賣資料');
    return chips;
  });
}

export function fetchDividends(code: string): Promise<Dividend[]> {
  return cached(`div|${code}`, async () => parseDividends((await fm('TaiwanStockDividend', code, daysAgo(365 * 6)))?.data));
}
