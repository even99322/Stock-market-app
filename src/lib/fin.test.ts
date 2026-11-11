import { describe, expect, it } from 'vitest';
import { analyze, computeRatios, parseFinMind, parseMonthRevenue, parseYahooTimeseries, annualFromQuarters, type Financials } from './financials';
import { aggregateSectors, parseIndustry, parseTpex, parseTwse, rocDate } from './twmarket';
import isr from './__fixtures__/fm_is_2330.json';
import bsr from './__fixtures__/fm_bs_2330.json';
import cfr from './__fixtures__/fm_cf_2330.json';
import rev from './__fixtures__/fm_rev_2330.json';
import isb from './__fixtures__/fm_is_2881.json';
import bsb from './__fixtures__/fm_bs_2881.json';
import cfb from './__fixtures__/fm_cf_2881.json';
import yts from './__fixtures__/yts_AAPL.json';
import day from './__fixtures__/twse_day_all.json';
import tpex from './__fixtures__/tpex_daily.json';
import info from './__fixtures__/fm_info.json';

describe('FinMind 台積電', () => {
  const { quarters, financialCo } = parseFinMind((isr as any).data, (bsr as any).data, (cfr as any).data);
  const q = (end: string) => quarters.find((x) => x.end === end)!;
  it('單季損益', () => {
    expect(financialCo).toBe(false);
    expect(q('2025-12-31').revenue).toBeCloseTo(1046090421000);
    expect(q('2026-06-30').eps).toBeCloseTo(27.25);
    expect(q('2026-06-30').gross! / q('2026-06-30').revenue!).toBeGreaterThan(0.5);
  });
  it('現金流由累計換算為單季', () => {
    // 2025 Q2 累計 1,122.6B − Q1 625.6B = 497.1B
    expect(q('2025-06-30').ocf).toBeCloseTo(1122637757000 - 625573672000);
    expect(q('2025-03-31').ocf).toBeCloseTo(625573672000);
    expect(q('2026-03-31').ocf).toBeCloseTo(698976265000); // 新年度重新累計
    expect(q('2025-06-30').capex!).toBeCloseTo(-(628052531000 - 330826730000));
  });
  it('資產負債', () => {
    const L = quarters[quarters.length - 1];
    expect(L.assets).toBeGreaterThan(L.liabilities!);
    expect(L.equityParent).toBeGreaterThan(0);
  });
  it('比率與分析', () => {
    const f: Financials = { symbol: '2330.TW', currency: 'TWD', source: '', quarters, annual: annualFromQuarters(quarters), monthly: parseMonthRevenue((rev as any).data), financialCo };
    const r = computeRatios(f);
    expect(r.revYoy!).toBeGreaterThan(0.2);
    expect(r.roe!).toBeGreaterThan(0.2);
    expect(r.roe!).toBeLessThan(0.6);
    expect(r.epsTtm!).toBeCloseTo(19.51 + 22.08 + 27.25 + q('2025-09-30').eps!, 1);
    expect(r.debtRatio!).toBeLessThan(0.5);
    const ins = analyze(f, r);
    expect(ins.length).toBeGreaterThan(5);
    expect(f.annual.find((a) => a.key === 'FY2025')!.revenue).toBeGreaterThan(3.5e12);
  });
  it('月營收', () => {
    const m = parseMonthRevenue((rev as any).data);
    const last = m[m.length - 1];
    expect(last.ym).toBe('2026-10');
    expect(last.yoy).toBeDefined();
    expect(last.ytdYoy).toBeDefined();
  });
});

describe('FinMind 富邦金（金融業）', () => {
  it('偵測金融業並解析淨收益', () => {
    const { quarters, financialCo } = parseFinMind((isb as any).data, (bsb as any).data, (cfb as any).data);
    expect(financialCo).toBe(true);
    const L = quarters[quarters.length - 1];
    expect(L.revenue).toBeGreaterThan(0);
    expect(L.net).toBeDefined();
    expect(L.eps).toBeDefined();
  });
});

describe('Yahoo timeseries AAPL', () => {
  it('季與年', () => {
    const { quarters, annual, currency } = parseYahooTimeseries(yts);
    expect(currency).toBe('USD');
    expect(quarters.length).toBeGreaterThanOrEqual(4);
    expect(annual.length).toBeGreaterThanOrEqual(3);
    const L = quarters[quarters.length - 1];
    expect(L.revenue).toBeGreaterThan(5e10);
    expect(L.fcf).toBeDefined();
    const f: Financials = { symbol: 'AAPL', currency: 'USD', source: '', quarters, annual, monthly: [], financialCo: false };
    const r = computeRatios(f);
    expect(r.grossMargin!).toBeGreaterThan(0.35);
    expect(r.netTtm!).toBeGreaterThan(5e10);
  });
});

describe('台股板塊', () => {
  it('解析與彙總', () => {
    expect(rocDate('1151110')).toBe('2026-11-10');
    const qs = [...parseTwse(day as any), ...parseTpex(tpex as any)];
    expect(qs.length).toBeGreaterThan(150);
    const tsmc = qs.find((x) => x.code === '2330')!;
    expect(tsmc.symbol).toBe('2330.TW');
    expect(tsmc.value).toBeGreaterThan(1e9);
    const tp = qs.find((x) => x.market === 'tpex')!;
    expect(tp.symbol.endsWith('.TWO')).toBe(true);
    const ind = parseIndustry((info as any).data);
    expect(ind['2330']).toBe('半導體業');
    expect(ind['2317']).toBe('其他電子業');
    const sec = aggregateSectors(qs, ind);
    expect(sec[0].value).toBeGreaterThan(sec[1].value);
    expect(sec.find((s) => s.name === '半導體業')!.stocks[0].value).toBeGreaterThan(0);
    expect(sec.every((s) => s.name !== '電子工業')).toBe(true);
  });
});
