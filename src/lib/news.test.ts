import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { newsQuery, parseGoogleNews, parseYahooNews } from './news';
import { parseTaifex } from './taifex';
import { relatedMarkets } from './related';
import { fmtChartTime } from './format';
import { isIndex, normalizeSymbol } from './names';
import ys from './__fixtures__/ys_aapl.json';
import tf from './__fixtures__/taifex.json';

describe('新聞', () => {
  it('Google 新聞 RSS', () => {
    const xml = readFileSync('src/lib/__fixtures__/gn_2330.xml', 'utf8');
    const items = parseGoogleNews(xml);
    expect(items.length).toBeGreaterThan(8);
    const a = items.find((x) => x.source === '鉅亨網')!;
    expect(a.title.endsWith('鉅亨網')).toBe(false);
    expect(a.link.startsWith('https://news.google.com/')).toBe(true);
    expect(items[0].time).toBeGreaterThanOrEqual(items[1].time);
    expect(items.every((x) => x.time > 1.7e12)).toBe(true);
  });
  it('Yahoo 新聞', () => {
    const items = parseYahooNews(ys);
    expect(items.length).toBeGreaterThan(3);
    expect(items[0].lang).toBe('en');
    expect(items[0].time).toBeGreaterThan(1.7e12);
  });
  it('搜尋關鍵字', () => {
    expect(newsQuery('2330.TW', '台積電')).toBe('台積電 2330 when:14d');
    expect(newsQuery('3661.TW', '世芯-KY')).toBe('世芯 3661 when:14d');
    expect(newsQuery('NVDA', 'NVIDIA Corporation')).toBe('輝達 NVDA when:14d');
    expect(newsQuery('ZZZZ', 'Foo Bar Inc.')).toBe('Foo ZZZZ when:14d');
  });
});

describe('台指期', () => {
  it('近月日盤與夜盤', () => {
    const q = parseTaifex(tf as any);
    expect(q.map((x) => x.session)).toEqual(['日盤', '夜盤']);
    expect(q[0]).toMatchObject({ month: '202611', last: 42623, change: 1145, pct: 2.76, date: '11/10' });
    expect(q[1].last).toBe(42542);
  });
});

describe('相關市場', () => {
  const syms = (s: string, ind?: string) => relatedMarkets(s, ind).flatMap((g) => g.items.map((i) => i.s));
  it('台積電', () => {
    const s = syms('2330.TW', '半導體業');
    for (const x of ['^TWII', '^SOX', 'TWD=X', 'NQ=F', 'TSM', '0050.TW']) expect(s).toContain(x);
    expect(relatedMarkets('2330.TW').find((g) => g.title === '期貨')!.taifex).toBe(true);
  });
  it('金融股看利率、航運看油價', () => {
    expect(syms('2881.TW', '金融保險')).toContain('^TNX');
    expect(syms('2603.TW', '航運業')).toContain('CL=F');
  });
  it('美股', () => {
    const s = syms('NVDA');
    for (const x of ['^GSPC', '^VIX', 'ES=F', 'XLK', 'SOXX', '^TNX']) expect(s).toContain(x);
    expect(syms('SPY')).not.toContain('SPY');
    expect(syms('TSM')).toContain('2330.TW');
  });
});

describe('其他', () => {
  it('圖表時間標籤', () => {
    expect(fmtChartTime(Date.UTC(2026, 10, 11, 9, 51) / 1000)).toBe('2026年11月11日 上午9:51');
    expect(fmtChartTime(Date.UTC(2026, 10, 11, 13, 5) / 1000)).toBe('2026年11月11日 下午1:05');
    expect(fmtChartTime('2026-11-11')).toBe('2026年11月11日（三）');
    expect(fmtChartTime({ year: 2026, month: 11, day: 11 })).toBe('2026年11月11日（三）');
  });
  it('指數/期貨/匯率代號', () => {
    expect(isIndex('ES=F')).toBe(true);
    expect(isIndex('DX-Y.NYB')).toBe(true);
    expect(isIndex('AAPL')).toBe(false);
    expect(normalizeSymbol('twd=x')).toBe('TWD=X');
    expect(normalizeSymbol('brk.b')).toBe('BRK-B');
  });
});
