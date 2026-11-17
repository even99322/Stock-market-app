import { describe, expect, it } from 'vitest';
import { fmtPrice, fmtVol } from './format';
import { GLOBAL_GROUPS, GLOBAL_PICKS, globalItem, kindNote } from './global';
import { digitsOf, isIndex, kindOf, lookupName, marketOf, normalizeSymbol } from './names';
import { parseTxDaily } from './taifex';

const row = (date: string, contract: string, session: string, o: number, h: number, l: number, c: number, v: number) =>
  ({ date, futures_id: 'TX', contract_date: contract, open: o, max: h, min: l, close: c, volume: v, trading_session: session });

describe('全球市場', () => {
  it('種類與小數位數', () => {
    expect(kindOf('TWD=X')).toBe('fx');
    expect(kindOf('GC=F')).toBe('future');
    expect(kindOf('TX.TAIFEX')).toBe('future');
    expect(kindOf('^TNX')).toBe('rate');
    expect(kindOf('^TWII')).toBe('index');
    expect(kindOf('BTC-USD')).toBe('crypto');
    expect(kindOf('2330.TW')).toBe('stock');
    expect(kindOf('AAPL', 'EQUITY')).toBe('stock');
    expect(digitsOf('fx', 32.944)).toBe(3);
    expect(digitsOf('fx', 0.2043)).toBe(4);
    expect(digitsOf('fx', 159.5)).toBe(2);
    expect(digitsOf('future', 7450.5, 2)).toBe(2);
    expect(digitsOf('future', 5.989, 3)).toBe(3);
    expect(digitsOf('future', 3.107, 4)).toBe(3);
    expect(digitsOf('stock', 100)).toBeUndefined();
    expect(fmtPrice(0.2043, 'US', 4)).toBe('0.2043');
    expect(fmtPrice(40935, 'TW', 0)).toBe('40,935');
    expect(fmtVol(63335, 'TW', '口')).toBe('6.33 萬口');
    expect(fmtVol(0, 'US', 'none')).toBe('—');
  });

  it('這些標的都不能在模擬帳戶交易，且都有中文名稱與說明', () => {
    const all = GLOBAL_GROUPS.flatMap((g) => g.items);
    expect(new Set(all.map((i) => i.s)).size).toBe(all.length);
    for (const i of all) {
      expect(isIndex(i.s), i.s).toBe(true);
      expect(lookupName(i.s) || i.s === '^TWII', i.s).toBeTruthy();
      expect(normalizeSymbol(i.s), i.s).toBe(i.s);
      expect(kindNote(kindOf(i.s), i.s).lines.length, i.s).toBeGreaterThan(1);
    }
    for (const s of GLOBAL_PICKS) expect(globalItem(s), s).toBeTruthy();
    expect(marketOf('TX.TAIFEX')).toBe('TW');
  });

  it('台指期：每天取成交量最大的月份合約，忽略價差與無成交的合約', () => {
    const rows = [
      row('2026-11-13', '202611', 'position', 41000, 41200, 40800, 41100, 90000),
      row('2026-11-13', '202612', 'position', 41050, 41250, 40850, 41150, 4000),
      row('2026-11-13', '202611/202612', 'position', 60, 70, 50, 65, 99999),
      row('2026-11-16', '202611', 'position', 43600, 43700, 41100, 41150, 150000),
      row('2026-11-16', '202706', 'position', 0, 0, 0, 0, 0),
      row('2026-11-17', '202611', 'after_market', 40900, 41627, 40616, 40935, 63335),
      // 結算後近月量縮，次月成為主力
      row('2026-11-18', '202611', 'position', 41000, 41100, 40900, 41000, 500),
      row('2026-11-18', '202612', 'position', 41100, 41300, 41000, 41250, 120000),
    ];
    const day = parseTxDaily(rows, 'position');
    expect(day.map((b) => b.close)).toEqual([41100, 41150, 41250]);
    expect(day[0].volume).toBe(90000);
    expect(new Date(day[0].time * 1000).toISOString()).toBe('2026-11-13T01:00:00.000Z');
    const night = parseTxDaily(rows, 'after_market');
    expect(night).toHaveLength(1);
    expect(night[0].high).toBe(41627);
  });
});
