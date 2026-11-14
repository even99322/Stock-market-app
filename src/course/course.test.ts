import { describe, expect, it } from 'vitest';
import { COURSE, LESSONS } from './index';
import { caseData, chipsData, intraData, newsGroup, slice } from './cases';

describe('短線課程內容完整性', () => {
  it('課程 id 不重複、每課都有測驗', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(COURSE.length).toBe(10);
    expect(LESSONS.length).toBe(29);
    for (const l of LESSONS) expect(l.blocks.some((b) => b.t === 'quiz' || b.t === 'decide'), l.id).toBe(true);
  });

  it('所有圖表、新聞、籌碼引用都存在，標記日期都是交易日', () => {
    for (const l of LESSONS) for (const b of l.blocks) {
      const where = `${l.id} ${b.t}`;
      if (b.t === 'chart' || b.t === 'decide') {
        const c = caseData(b.c);
        const to = b.t === 'decide' ? b.to : b.to;
        const s = slice(b.c, b.from, to);
        expect(s.visible, where).toBeGreaterThan(5);
        if (b.t === 'decide') {
          expect(c.dates, where).toContain(b.upto);
          expect(b.upto > b.from && b.upto < b.to, where).toBe(true);
          expect(b.best, where).toBeLessThan(b.opts.length);
        }
        for (const n of b.notes || []) {
          expect(c.dates, `${where} note ${n.d}`).toContain(n.d);
          expect(n.d >= b.from && n.d <= to, `${where} note ${n.d} 在區間外`).toBe(true);
        }
        const lo = Math.min(...s.bars.slice(-s.visible).map((x) => x.low)), hi = Math.max(...s.bars.slice(-s.visible).map((x) => x.high));
        for (const ln of b.lines || []) expect(ln.price >= lo * 0.9 && ln.price <= hi * 1.1, `${where} line ${ln.price}`).toBe(true);
      }
      if (b.t === 'intra') {
        const d = intraData(b.c);
        expect(d.bars.length, where).toBeGreaterThan(40);
        for (const n of b.notes || []) expect(d.timeOf(n.d), `${where} note ${n.d}`).toBeTruthy();
      }
      if (b.t === 'news') {
        const g = newsGroup(b.g);
        expect(g.length, where).toBeGreaterThan(0);
        for (const i of b.only || []) expect(g[i], `${where} #${i}`).toBeTruthy();
      }
      if (b.t === 'chips') {
        const d = chipsData();
        const rows = (b.kind === 'inst' ? d.inst : d.margin).filter((r) => r[0] >= b.from && r[0] <= b.to);
        expect(rows.length, where).toBeGreaterThan(10);
      }
      if (b.t === 'quiz') expect(b.a, where).toBeLessThan(b.opts.length);
      if (b.t === 'go') expect(/^(replay|course|company|stock|learn)/.test(b.to), where).toBe(true);
    }
  });

  it('課文引用的關鍵數字與資料一致', () => {
    const bar = (k: string, d: string) => { const c = caseData(k); return c.bars[c.dates.indexOf(d)]; };
    expect(bar('umc', '2026-01-07').close).toBe(54.1);
    expect(bar('umc', '2026-01-29').close).toBe(68.4);
    expect(bar('hh', '2026-03-03').close).toBe(229);
    expect(bar('ym', '2026-03-04').high).toBe(69.9);
    expect(Math.round(bar('twii', '2026-03-09').low)).toBe(31529);
  });
});
