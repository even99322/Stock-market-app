import { describe, expect, it, vi } from 'vitest';
import fx from './__fixtures__/fx_cny.json';
import { cleanSpikes, combineBars, fxPairOf, fxValue } from './fxcross';
import type { Bar } from './types';

// 用 2026-11-17 實際抓到的 Yahoo 資料（TWDCNY=X 當天混入約 0.1938 的錯誤報價）
vi.mock('./http', async (orig) => {
  const m: any = await orig();
  return {
    ...m,
    getJSON: vi.fn(async (url: string) => {
      const mm = url.match(/chart\/([^?]+)\?range=(\w+)/);
      const key = `${decodeURIComponent(mm![1])}|${mm![2]}`;
      const hit = (fx as any)[key];
      if (!hit) throw new m.HttpError(404, 'no fixture ' + key);
      return hit;
    }),
  };
});

describe('外幣兌台幣換算', () => {
  it('辨認幣別與方向', () => {
    expect(fxPairOf('JPYTWD=X')).toMatchObject({ ccy: 'JPY', leg: 'JPY=X', op: 'div', inverse: false, always: false });
    expect(fxPairOf('EURTWD=X')).toMatchObject({ leg: 'EURUSD=X', op: 'mul' });
    expect(fxPairOf('TWDCNY=X')).toMatchObject({ ccy: 'CNY', inverse: true, always: true });
    expect(fxPairOf('CNYTWD=X')).toMatchObject({ ccy: 'CNY', inverse: false, always: true });
    expect(fxPairOf('TWD=X')).toBeNull();
    expect(fxPairOf('EURJPY=X')).toBeNull();
    expect(fxPairOf('INRTWD=X')).toBeNull(); // 沒有對應的美元腿
    // 32.9 台幣/美元、159 日圓/美元 → 1 日圓 ≈ 0.207 台幣
    expect(fxValue(fxPairOf('JPYTWD=X')!)(32.9, 159)).toBeCloseTo(0.2069, 4);
    expect(fxValue(fxPairOf('EURTWD=X')!)(32.9, 1.1)).toBeCloseTo(36.19, 2);
    expect(fxValue(fxPairOf('TWDCNY=X')!)(32.901, 6.6652)).toBeCloseTo(0.2026, 4);
  });

  it('人民幣改用換算值：現價正確、盤中 K 線不再出現整片長條', async () => {
    const { fetchChart } = await import('./market');
    for (const sym of ['TWDCNY=X', 'CNYTWD=X']) {
      const c = await fetchChart(sym, '1d', true);
      expect(c.demo).toBe(false);
      expect(c.exchangeName).toBe('以美元匯率換算');
      const want = sym === 'TWDCNY=X' ? 6.6652 / 32.901 : 32.901 / 6.6652;
      expect(c.price / want - 1).toBeLessThan(0.001);
      expect(c.bars.length).toBeGreaterThan(100);
      // 原始資料當天收盤價在 0.1935～0.2019 之間來回跳（4.3%）；換算後整天收盤價區間不到 0.5%
      const cl = c.bars.map((x) => x.close);
      expect(Math.max(...cl) / Math.min(...cl) - 1).toBeLessThan(0.005);
      // 單根 5 分 K 的高低差：最大是台北 9:00 開盤那根（美元/台幣本身就波動 0.49%）
      for (const x of c.bars) expect(x.high / x.low - 1).toBeLessThan(0.008);
      expect(c.kind).toBe('fx');
      expect(c.volUnit).toBe('none');
    }
    const d = await fetchChart('TWDCNY=X', '1mo', true);
    expect(d.bars.length).toBeGreaterThan(18);
    expect(d.bars[d.bars.length - 1].close).toBeCloseTo(0.2026, 3);
  });

  it('對齊時間：另一組缺值時沿用前一根', () => {
    const a: Bar[] = [1, 2, 3, 4].map((t) => ({ time: t * 300, open: 32, high: 32, low: 32, close: 32, volume: 0 }));
    const b: Bar[] = [1, 3].map((t) => ({ time: t * 300, open: 160, high: 160, low: 160, close: 160, volume: 0 }));
    const out = combineBars(a, b, (x, y) => x / y);
    expect(out).toHaveLength(4);
    expect(out[1].close).toBeCloseTo(0.2, 6);
  });

  it('清除零星的錯誤報價，但保留真實的趨勢', () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => {
      const p = 0.2014 + i * 0.00001;
      return { time: i * 300, open: p, high: p, low: p, close: p, volume: 0 };
    });
    bars[10] = { ...bars[10], low: 0.1938, close: 0.1938 };
    const out = cleanSpikes(bars);
    expect(out[10].close).toBeCloseTo(0.2015, 3);
    expect(out[10].low).toBeGreaterThan(0.2);
    expect(out[20]).toEqual(bars[20]);
    // 持續性的移動（例如央行干預）不會被抹掉
    const step: Bar[] = Array.from({ length: 30 }, (_, i) => {
      const p = i < 15 ? 150 : 145;
      return { time: i * 300, open: p, high: p, low: p, close: p, volume: 0 };
    });
    expect(cleanSpikes(step).map((b) => b.close)).toEqual(step.map((b) => b.close));
  });
});
