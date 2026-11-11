// 財報資料：台股用 FinMind（單季損益、資產負債、累計現金流、月營收），美股用 Yahoo fundamentals-timeseries。
// 輸出統一的 FinPeriod 陣列，再計算財務比率與文字分析。
import { getJSON } from './http';
import { finmindHeaders } from './twmarket';
import type { Currency } from './types';

export interface FinPeriod {
  key: string; // 2026Q2 / FY2025
  end: string; // YYYY-MM-DD
  revenue?: number;
  cogs?: number;
  gross?: number;
  opex?: number;
  opIncome?: number;
  nonOp?: number;
  preTax?: number;
  net?: number;
  netParent?: number;
  eps?: number;
  rnd?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  equityParent?: number;
  curAssets?: number;
  curLiab?: number;
  cash?: number;
  inventory?: number;
  receivable?: number;
  ocf?: number;
  capex?: number; // 負值
  fcf?: number;
}

export interface MonthRev { ym: string; revenue: number; yoy?: number; mom?: number; ytd?: number; ytdYoy?: number }

export interface Financials {
  symbol: string;
  currency: Currency;
  source: string;
  quarters: FinPeriod[]; // 由舊到新
  annual: FinPeriod[];
  monthly: MonthRev[];
  /** 金融業（銀行、保險、證券）財報結構不同 */
  financialCo: boolean;
}

const qKey = (end: string) => {
  const [y, m] = end.split('-').map(Number);
  return `${y}Q${Math.ceil(m / 3)}`;
};

// ---------------- 台股：FinMind ----------------
type FmRow = { date: string; type: string; value: number; origin_name?: string };
function groupFm(rows: FmRow[]) {
  const by: Record<string, Record<string, number>> = {};
  for (const r of rows || []) {
    if (!r?.date || r.type?.endsWith('_per')) continue;
    (by[r.date] ||= {})[r.type] = r.value;
  }
  return by;
}
const pickV = (o: Record<string, number> | undefined, ...keys: string[]) => {
  if (!o) return undefined;
  for (const k of keys) if (o[k] != null && Number.isFinite(o[k])) return o[k];
  return undefined;
};

const FLOW_KEYS: (keyof FinPeriod)[] = ['revenue', 'cogs', 'gross', 'opex', 'opIncome', 'nonOp', 'preTax', 'net', 'netParent', 'eps'];

export function parseFinMind(isRows: FmRow[], bsRows: FmRow[], cfRows: FmRow[]): { quarters: FinPeriod[]; financialCo: boolean } {
  const is = groupFm(isRows), bs = groupFm(bsRows), cf = groupFm(cfRows);
  const dates = [...new Set([...Object.keys(is), ...Object.keys(bs)])].sort();
  const financialCo = Object.values(is).some((o) => o.NetInterestIncome != null || o.NetNonInterestIncome != null);
  const qs: FinPeriod[] = dates.map((d) => {
    const i = is[d], b = bs[d];
    const p: FinPeriod = {
      key: qKey(d), end: d,
      revenue: pickV(i, 'Revenue'),
      cogs: pickV(i, 'CostOfGoodsSold'),
      gross: pickV(i, 'GrossProfit'),
      opex: pickV(i, 'OperatingExpenses'),
      opIncome: pickV(i, 'OperatingIncome'),
      nonOp: pickV(i, 'TotalNonoperatingIncomeAndExpense'),
      preTax: pickV(i, 'PreTaxIncome'),
      net: pickV(i, 'IncomeAfterTaxes', 'IncomeAfterTax', 'IncomeFromContinuingOperations'),
      netParent: pickV(i, 'EquityAttributableToOwnersOfParent'),
      eps: pickV(i, 'EPS'),
      assets: pickV(b, 'TotalAssets'),
      liabilities: pickV(b, 'Liabilities'),
      equity: pickV(b, 'Equity'),
      equityParent: pickV(b, 'EquityAttributableToOwnersOfParent'),
      curAssets: pickV(b, 'CurrentAssets'),
      curLiab: pickV(b, 'CurrentLiabilities'),
      cash: pickV(b, 'CashAndCashEquivalents'),
      inventory: pickV(b, 'Inventories'),
      receivable: pickV(b, 'AccountsReceivableNet'),
    };
    if (p.netParent == null) p.netParent = p.net;
    if (p.equityParent == null) p.equityParent = p.equity;
    return p;
  });

  // 保險機制：第四季若是「全年數」（營收與 EPS 都超過前三季平均的 2.5 倍），換算成單季。
  // FinMind 目前提供的是單季數，金融業季度波動大，不套用。
  for (let k = 0; k < qs.length && !financialCo; k++) {
    const q = qs[k];
    if (!q.end.endsWith('-12-31')) continue;
    const y = q.end.slice(0, 4);
    const prev = ['03-31', '06-30', '09-30'].map((md) => qs.find((x) => x.end === `${y}-${md}`));
    if (prev.some((x) => !x || x.revenue == null || x.eps == null) || q.revenue == null || q.eps == null) continue;
    const avgRev = prev.reduce((a, x) => a + x!.revenue!, 0) / 3;
    const avgEps = prev.reduce((a, x) => a + x!.eps!, 0) / 3;
    if (avgRev > 0 && avgEps > 0 && q.revenue > 2.5 * avgRev && q.eps > 2.5 * avgEps) {
      for (const f of FLOW_KEYS) {
        const v = q[f] as number | undefined;
        if (v == null || prev.some((x) => x![f] == null)) continue;
        (q as any)[f] = v - prev.reduce((a, x) => a + (x![f] as number), 0);
      }
    }
  }

  // 現金流量表在台灣是「年初累計」，換算成單季
  const cfDates = Object.keys(cf).sort();
  const cum = (d: string, ...k: string[]) => pickV(cf[d], ...k);
  let cumulative = false;
  for (const d of cfDates) {
    if (!d.endsWith('-06-30')) continue;
    const c = cum(d, 'NetIncomeBeforeTax', 'IncomeBeforeIncomeTaxFromContinuingOperations');
    const single = qs.find((x) => x.end === d)?.preTax;
    if (c != null && single != null && Math.abs(single) > 0) { cumulative = Math.abs(c) > 1.5 * Math.abs(single); break; }
  }
  for (const q of qs) {
    const d = q.end;
    if (!cf[d]) continue;
    const ocfKeys = ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities'];
    const capKeys = ['PropertyAndPlantAndEquipment'];
    let ocf = cum(d, ...ocfKeys), capex = cum(d, ...capKeys);
    if (cumulative && !d.endsWith('-03-31')) {
      const y = d.slice(0, 4), m = +d.slice(5, 7);
      const prevD = `${y}-${String(m - 3).padStart(2, '0')}-${m - 3 === 6 ? '30' : m - 3 === 9 ? '30' : '31'}`;
      const pOcf = cum(prevD, ...ocfKeys), pCap = cum(prevD, ...capKeys);
      ocf = ocf != null && pOcf != null ? ocf - pOcf : undefined;
      capex = capex != null && pCap != null ? capex - pCap : undefined;
    }
    q.ocf = ocf;
    q.capex = capex != null ? -Math.abs(capex) : undefined;
    if (q.ocf != null) q.fcf = q.ocf + (q.capex ?? 0);
  }
  return { quarters: qs.filter((q) => q.revenue != null || q.assets != null), financialCo };
}

export function parseMonthRevenue(rows: { revenue: number; revenue_month: number; revenue_year: number }[]): MonthRev[] {
  const map = new Map<string, number>();
  for (const r of rows || []) {
    if (!r?.revenue_year || !r.revenue_month) continue;
    map.set(`${r.revenue_year}-${String(r.revenue_month).padStart(2, '0')}`, r.revenue);
  }
  const keys = [...map.keys()].sort();
  return keys.map((ym) => {
    const [y, m] = ym.split('-').map(Number);
    const rev = map.get(ym)!;
    const ly = map.get(`${y - 1}-${String(m).padStart(2, '0')}`);
    const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const prev = map.get(pm);
    let ytd = 0, lytd = 0, okY = true;
    for (let k = 1; k <= m; k++) {
      const a = map.get(`${y}-${String(k).padStart(2, '0')}`), b = map.get(`${y - 1}-${String(k).padStart(2, '0')}`);
      if (a == null || b == null) okY = false;
      ytd += a ?? 0; lytd += b ?? 0;
    }
    return {
      ym, revenue: rev,
      yoy: ly ? rev / ly - 1 : undefined,
      mom: prev ? rev / prev - 1 : undefined,
      ytd: okY ? ytd : undefined,
      ytdYoy: okY && lytd ? ytd / lytd - 1 : undefined,
    };
  });
}

/** 年度彙總（由季資料加總，資產負債取年底） */
export function annualFromQuarters(qs: FinPeriod[]): FinPeriod[] {
  const years = [...new Set(qs.map((q) => q.end.slice(0, 4)))].sort();
  const out: FinPeriod[] = [];
  for (const y of years) {
    const four = qs.filter((q) => q.end.startsWith(y));
    if (four.length !== 4) continue;
    const last = four[3];
    const a: FinPeriod = { ...last, key: `FY${y}`, end: last.end };
    for (const f of [...FLOW_KEYS, 'ocf', 'capex', 'fcf'] as (keyof FinPeriod)[]) {
      const vals = four.map((q) => q[f] as number | undefined);
      (a as any)[f] = vals.every((v) => v != null) ? vals.reduce((s, v) => s + v!, 0) : undefined;
    }
    out.push(a);
  }
  return out;
}

export async function fetchFinancialsTW(code: string, symbol: string): Promise<Financials> {
  const y = new Date().getFullYear() - 3;
  const base = 'https://api.finmindtrade.com/api/v4/data?';
  const q = (ds: string, start: string) => `${base}dataset=${ds}&data_id=${code}&start_date=${start}`;
  const h = finmindHeaders();
  const [isr, bsr, cfr, rev] = await Promise.all([
    getJSON<any>(q('TaiwanStockFinancialStatements', `${y}-01-01`), h),
    getJSON<any>(q('TaiwanStockBalanceSheet', `${y}-01-01`), h),
    getJSON<any>(q('TaiwanStockCashFlowsStatement', `${y}-01-01`), h),
    getJSON<any>(q('TaiwanStockMonthRevenue', `${y}-01-01`), h).catch(() => ({ data: [] })),
  ]);
  const msg = [isr, bsr].find((d) => d?.status && d.status !== 200)?.msg;
  if (msg) throw new Error(`FinMind：${msg}`);
  const { quarters, financialCo } = parseFinMind(isr?.data || [], bsr?.data || [], cfr?.data || []);
  if (!quarters.length) throw new Error('查無財報資料（可能是 ETF、新上市或資料源暫時無法使用）');
  return {
    symbol, currency: 'TWD', source: 'FinMind（公開資訊觀測站財報）',
    quarters, annual: annualFromQuarters(quarters), monthly: parseMonthRevenue(rev?.data || []), financialCo,
  };
}

// ---------------- 美股（及台股備援）：Yahoo fundamentals-timeseries ----------------
const YT: Record<string, keyof FinPeriod> = {
  TotalRevenue: 'revenue', CostOfRevenue: 'cogs', GrossProfit: 'gross', OperatingExpense: 'opex',
  OperatingIncome: 'opIncome', PretaxIncome: 'preTax', NetIncome: 'net', NetIncomeCommonStockholders: 'netParent',
  DilutedEPS: 'eps', ResearchAndDevelopment: 'rnd', TotalAssets: 'assets', TotalLiabilitiesNetMinorityInterest: 'liabilities',
  StockholdersEquity: 'equityParent', CurrentAssets: 'curAssets', CurrentLiabilities: 'curLiab',
  CashAndCashEquivalents: 'cash', Inventory: 'inventory', AccountsReceivable: 'receivable',
  OperatingCashFlow: 'ocf', CapitalExpenditure: 'capex', FreeCashFlow: 'fcf',
};

export function parseYahooTimeseries(d: any): { quarters: FinPeriod[]; annual: FinPeriod[]; currency?: string } {
  const res: any[] = d?.timeseries?.result || [];
  const q: Record<string, FinPeriod> = {}, a: Record<string, FinPeriod> = {};
  let currency: string | undefined;
  for (const r of res) {
    const type: string = r?.meta?.type?.[0];
    if (!type) continue;
    const m = /^(quarterly|annual)(.+)$/.exec(type);
    if (!m) continue;
    const field = YT[m[2]];
    if (!field) continue;
    const target = m[1] === 'quarterly' ? q : a;
    for (const v of r[type] || []) {
      if (!v?.asOfDate || v.reportedValue?.raw == null) continue;
      currency ||= v.currencyCode;
      const p = (target[v.asOfDate] ||= { key: m[1] === 'quarterly' ? qKey(v.asOfDate) : `FY${v.asOfDate.slice(0, 4)}`, end: v.asOfDate });
      (p as any)[field] = v.reportedValue.raw;
    }
  }
  const fix = (p: FinPeriod) => {
    if (p.netParent == null) p.netParent = p.net;
    if (p.equity == null) p.equity = p.equityParent;
    if (p.gross == null && p.revenue != null && p.cogs != null) p.gross = p.revenue - p.cogs;
    if (p.fcf == null && p.ocf != null) p.fcf = p.ocf + (p.capex ?? 0);
    return p;
  };
  const sort = (o: Record<string, FinPeriod>) => Object.values(o).map(fix).sort((x, y) => (x.end < y.end ? -1 : 1));
  return { quarters: sort(q), annual: sort(a), currency };
}

export async function fetchFinancialsYahoo(symbol: string): Promise<Financials> {
  const types = Object.keys(YT).flatMap((t) => [`quarterly${t}`, `annual${t}`]).join(',');
  const p1 = Math.floor(Date.now() / 1000) - 6 * 365 * 86400;
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${types}&period1=${p1}&period2=${p2}`;
  const d = await getJSON<any>(url);
  const { quarters, annual, currency } = parseYahooTimeseries(d);
  if (!quarters.length && !annual.length) throw new Error('查無財報資料（ETF 或指數沒有財報）');
  return {
    symbol, currency: currency === 'TWD' ? 'TWD' : 'USD', source: 'Yahoo Finance',
    quarters, annual, monthly: [], financialCo: false,
  };
}

const cache = new Map<string, { at: number; data: Financials }>();
export async function fetchFinancials(symbol: string): Promise<Financials> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.data;
  let data: Financials;
  const m = /^(\d{4,6}[A-Z]?)\.(TW|TWO)$/.exec(symbol);
  if (m) {
    try {
      data = await fetchFinancialsTW(m[1], symbol);
    } catch (e) {
      try { data = await fetchFinancialsYahoo(symbol); data.source += '（FinMind 失敗時的備援）'; } catch { throw e; }
    }
  } else {
    data = await fetchFinancialsYahoo(symbol);
  }
  cache.set(symbol, { at: Date.now(), data });
  return data;
}

// ---------------- 比率與分析 ----------------
export interface Ratios {
  grossMargin?: number;
  opMargin?: number;
  netMargin?: number;
  revYoy?: number;
  revQoq?: number;
  epsTtm?: number;
  netTtm?: number;
  revTtm?: number;
  roe?: number;
  roa?: number;
  debtRatio?: number;
  currentRatio?: number;
  fcfTtm?: number;
  ocfTtm?: number;
  capexToRev?: number;
  invYoy?: number;
  rndToRev?: number;
}
const div = (a?: number, b?: number) => (a != null && b != null && b !== 0 ? a / b : undefined);
const sum4 = (qs: FinPeriod[], f: keyof FinPeriod) => {
  if (qs.length < 4) return undefined;
  const v = qs.slice(-4).map((q) => q[f] as number | undefined);
  return v.every((x) => x != null) ? v.reduce((s, x) => s + x!, 0) : undefined;
};

export function margins(p: FinPeriod) {
  return { gm: div(p.gross, p.revenue), om: div(p.opIncome, p.revenue), nm: div(p.netParent ?? p.net, p.revenue) };
}

export function computeRatios(f: Financials): Ratios {
  const qs = f.quarters;
  const L = qs[qs.length - 1];
  if (!L) return {};
  const yAgo = qs.find((q) => q.end.slice(5) === L.end.slice(5) && +q.end.slice(0, 4) === +L.end.slice(0, 4) - 1);
  const prev = qs[qs.length - 2];
  const m = margins(L);
  const netTtm = sum4(qs, 'netParent') ?? f.annual[f.annual.length - 1]?.netParent;
  const revTtm = sum4(qs, 'revenue') ?? f.annual[f.annual.length - 1]?.revenue;
  const eq = L.equityParent ?? L.equity;
  const eqOld = yAgo?.equityParent ?? yAgo?.equity;
  const avgEq = eq != null && eqOld != null ? (eq + eqOld) / 2 : eq;
  const ocfTtm = sum4(qs, 'ocf') ?? f.annual[f.annual.length - 1]?.ocf;
  const capTtm = sum4(qs, 'capex') ?? f.annual[f.annual.length - 1]?.capex;
  return {
    grossMargin: f.financialCo ? undefined : m.gm,
    opMargin: m.om,
    netMargin: m.nm,
    revYoy: div(L.revenue, yAgo?.revenue) != null ? div(L.revenue, yAgo?.revenue)! - 1 : undefined,
    revQoq: div(L.revenue, prev?.revenue) != null ? div(L.revenue, prev?.revenue)! - 1 : undefined,
    epsTtm: sum4(qs, 'eps') ?? f.annual[f.annual.length - 1]?.eps,
    netTtm, revTtm,
    roe: div(netTtm, avgEq),
    roa: div(netTtm, L.assets),
    debtRatio: div(L.liabilities, L.assets),
    currentRatio: f.financialCo ? undefined : div(L.curAssets, L.curLiab),
    ocfTtm,
    fcfTtm: ocfTtm != null ? ocfTtm + (capTtm ?? 0) : undefined,
    capexToRev: capTtm != null ? div(-capTtm, revTtm) : undefined,
    invYoy: div(L.inventory, yAgo?.inventory) != null ? div(L.inventory, yAgo?.inventory)! - 1 : undefined,
    rndToRev: div(sum4(qs, 'rnd'), revTtm),
  };
}

export interface Insight { tone: 'good' | 'bad' | 'neutral'; text: string; topic?: string }
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

/** 以簡單規則產生文字解讀（僅供學習，不是投資建議） */
export function analyze(f: Financials, r: Ratios): Insight[] {
  const out: Insight[] = [];
  const qs = f.quarters;
  const L = qs[qs.length - 1];
  if (!L) return out;
  if (r.revYoy != null) {
    const y = r.revYoy;
    out.push({
      tone: y > 0.05 ? 'good' : y < -0.05 ? 'bad' : 'neutral', topic: 'revenue',
      text: Math.abs(y) > 1.5
        ? `最新一季（${L.key}）營收年增 ${pct(y)}，但去年同期基期異常${y > 0 ? '偏低' : '偏高'}，這個年增率參考性有限，建議看近四季合計或年度趨勢。`
        : `最新一季（${L.key}）營收年增 ${pct(y)}：${y > 0.2 ? '強勁成長' : y > 0.05 ? '穩定成長' : y >= -0.05 ? '大致持平' : '衰退，需要了解原因（景氣循環、失去訂單或產品週期）'}。`,
    });
  }
  const mr = f.monthly[f.monthly.length - 1];
  if (mr?.yoy != null) {
    out.push({
      tone: mr.yoy > 0.05 ? 'good' : mr.yoy < -0.05 ? 'bad' : 'neutral', topic: 'monthrev',
      text: `最新月營收（${mr.ym}）年增 ${pct(mr.yoy)}${mr.ytdYoy != null ? `，今年累計年增 ${pct(mr.ytdYoy)}` : ''}。月營收是台股最即時的營運指標。`,
    });
  }
  if (!f.financialCo && r.grossMargin != null) {
    const old = qs.length >= 5 ? margins(qs[qs.length - 5]).gm : undefined;
    const diff = old != null ? r.grossMargin - old : undefined;
    out.push({
      tone: diff == null ? 'neutral' : diff > 0.015 ? 'good' : diff < -0.015 ? 'bad' : 'neutral', topic: 'margins',
      text: `毛利率 ${pct(r.grossMargin)}${diff != null ? `，較去年同期${diff >= 0 ? '提升' : '下降'} ${Math.abs(diff * 100).toFixed(1)} 個百分點` : ''}。${r.grossMargin > 0.5 ? '毛利率很高，代表產品有定價能力或技術門檻。' : r.grossMargin < 0.1 ? '毛利率偏低，屬於代工、通路或大宗商品型態，獲利對規模與成本控制很敏感。' : ''}`,
    });
  }
  if (r.opMargin != null && r.netMargin != null && L.opIncome != null && L.nonOp != null && L.preTax) {
    const share = L.nonOp / L.preTax;
    if (Math.abs(share) > 0.3) out.push({
      tone: 'neutral', topic: 'margins',
      text: `業外損益佔稅前淨利 ${pct(share, 0)}，獲利受業外（投資、匯兌、利息）影響大，分析時要分開看本業。`,
    });
  }
  if (r.roe != null) {
    out.push({
      tone: r.roe > 0.15 ? 'good' : r.roe < 0.08 ? 'bad' : 'neutral', topic: 'roe',
      text: `近四季 ROE ${pct(r.roe)}：${r.roe > 0.2 ? '非常優異' : r.roe > 0.15 ? '優良' : r.roe > 0.08 ? '普通' : '偏低'}。${r.debtRatio != null && r.debtRatio > 0.6 && !f.financialCo ? '但負債比偏高，ROE 有一部分是靠財務槓桿撐起來的。' : ''}`,
    });
  }
  if (r.epsTtm != null) {
    const prev4 = qs.length >= 8 ? qs.slice(-8, -4).map((q) => q.eps) : [];
    const old = prev4.length === 4 && prev4.every((x) => x != null) ? prev4.reduce((s, x) => s + x!, 0) : undefined;
    out.push({
      tone: old == null ? 'neutral' : r.epsTtm > old ? 'good' : 'bad', topic: 'eps',
      text: `近四季 EPS ${r.epsTtm.toFixed(2)} ${f.currency === 'USD' ? '美元' : '元'}${old != null ? `（前四季 ${old.toFixed(2)}，${r.epsTtm >= old ? '成長' : '衰退'} ${pct(Math.abs(r.epsTtm / old - 1))}）` : ''}。`,
    });
  }
  if (f.financialCo) {
    out.push({ tone: 'neutral', topic: 'finco', text: '這是金融業：營收以利息與手續費收入為主，負債比天生很高（存款就是負債），不適用一般產業的毛利率、流動比率判斷。' });
  } else {
    if (r.debtRatio != null) out.push({
      tone: r.debtRatio > 0.6 ? 'bad' : r.debtRatio < 0.4 ? 'good' : 'neutral', topic: 'debt',
      text: `負債比 ${pct(r.debtRatio)}：${r.debtRatio > 0.6 ? '偏高，景氣反轉時壓力較大' : r.debtRatio < 0.4 ? '財務結構穩健' : '中等'}。`,
    });
    if (r.currentRatio != null) out.push({
      tone: r.currentRatio < 1 ? 'bad' : r.currentRatio > 1.5 ? 'good' : 'neutral', topic: 'debt',
      text: `流動比率 ${r.currentRatio.toFixed(2)} 倍：${r.currentRatio < 1 ? '短期資產不足以支應短期負債，留意資金調度' : r.currentRatio > 1.5 ? '短期償債能力充足' : '尚可'}。`,
    });
  }
  if (r.fcfTtm != null) {
    out.push({
      tone: r.fcfTtm > 0 ? 'good' : 'bad', topic: 'fcf',
      text: `近四季自由現金流${r.fcfTtm > 0 ? '為正' : '為負'}${r.capexToRev != null && r.capexToRev > 0.2 ? `；資本支出佔營收 ${pct(r.capexToRev, 0)}，屬於重資本投資型產業` : ''}${r.fcfTtm < 0 && r.netTtm != null && r.netTtm > 0 ? '，帳面有獲利但現金流出，常見於大量擴產或存貨、應收增加' : ''}。`,
    });
  }
  if (r.invYoy != null && r.revYoy != null && r.invYoy - r.revYoy > 0.25) {
    out.push({ tone: 'bad', topic: 'inventory', text: `存貨年增 ${pct(r.invYoy)}，明顯高於營收成長，可能有庫存堆積、日後跌價的風險。` });
  }
  if (r.rndToRev != null && r.rndToRev > 0.1) {
    out.push({ tone: 'neutral', text: `研發費用佔營收 ${pct(r.rndToRev, 0)}，屬研發密集型公司。` });
  }
  return out;
}
