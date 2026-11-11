import { useEffect, useRef } from 'react';
import { createChart, ColorType, type Time } from 'lightweight-charts';

export interface LineSeriesDef { name: string; color: string; data: { d: string; v: number }[]; area?: boolean }

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** 資產曲線等簡單折線圖。d 為 YYYY-MM-DD */
export function LineChart({ series, height = 220, hideDates }: { series: LineSeriesDef[]; height?: number; hideDates?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const grid = css('--grid') || '#1f2738';
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: css('--panel') || '#151b28' }, textColor: css('--muted') || '#8a94a8', fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, visible: !hideDates },
      localization: { locale: 'zh-TW', timeFormatter: hideDates ? () => '' : undefined },
      handleScroll: false,
      handleScale: false,
    });
    for (const s of series) {
      const data = dedupe(s.data).map((x) => ({ time: x.d as Time, value: x.v }));
      if (s.area) {
        chart.addAreaSeries({ lineColor: s.color, topColor: s.color + '55', bottomColor: s.color + '05', lineWidth: 2, priceLineVisible: false, title: s.name, priceFormat: { type: 'price', precision: 0, minMove: 1 } }).setData(data);
      } else {
        chart.addLineSeries({ color: s.color, lineWidth: 2, priceLineVisible: false, title: s.name, priceFormat: { type: 'price', precision: 0, minMove: 1 } }).setData(data);
      }
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, hideDates]);
  return <div ref={ref} style={{ height }} className="line-chart" />;
}

function dedupe(a: { d: string; v: number }[]) {
  const m = new Map<string, number>();
  for (const x of a) m.set(x.d, x.v);
  return [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([d, v]) => ({ d, v }));
}
