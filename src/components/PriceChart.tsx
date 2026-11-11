import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CrosshairMode, ColorType, LineStyle,
  type IChartApi, type Time, type SeriesMarker, type LogicalRange,
} from 'lightweight-charts';
import { sma, bollinger, rsi, macd, kd, obv, type Series } from '../lib/indicators';
import { cls, dateStr, fmtChartTime, fmtPrice, fmtVol } from '../lib/format';
import type { Bar, Market, Trade } from '../lib/types';

export type SubKind = 'none' | 'rsi' | 'macd' | 'kd' | 'obv';
export interface Overlays { ma: boolean; boll: boolean }

interface Props {
  bars: Bar[];
  intraday: boolean;
  gmtoffset: number;
  market: Market;
  overlays: Overlays;
  sub: SubKind;
  redUp: boolean;
  trades?: Trade[];
  height?: number;
  /** 回放時固定顯示最後 N 根 */
  visibleBars?: number;
  hideDates?: boolean;
  /** 昨收價：提供時畫出「昨收」參考線，標籤的漲跌幅也以它為基準（1 日圖用） */
  baseline?: number;
}

const MA_COLORS = { 5: '#f5c542', 20: '#e46cf0', 60: '#4ea1ff' } as const;
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();


export function PriceChart(p: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [legend, setLegend] = useState<{ bar: Bar; i: number; x: number } | null>(null);
  const up = p.redUp ? '#f0475a' : '#22b07d';
  const down = p.redUp ? '#22b07d' : '#f0475a';

  const toTime = useMemo(
    () => (t: number): Time => (p.intraday ? ((t + p.gmtoffset) as Time) : (dateStr(t, p.gmtoffset) as Time)),
    [p.intraday, p.gmtoffset],
  );

  const ind = useMemo(() => {
    const c = p.bars.map((b) => b.close);
    return {
      ma5: sma(c, 5), ma20: sma(c, 20), ma60: sma(c, 60),
      boll: bollinger(c), rsi: rsi(c), macd: macd(c), kd: kd(p.bars), obv: obv(p.bars),
      vma: sma(p.bars.map((b) => b.volume), 20),
    };
  }, [p.bars]);

  useEffect(() => {
    if (!mainRef.current || !p.bars.length) return;
    const bg = css('--panel') || '#151b28';
    const text = css('--muted') || '#8a94a8';
    const grid = css('--grid') || '#1f2738';
    const base = {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: bg }, textColor: text, fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: grid },
      timeScale: {
        borderColor: grid, timeVisible: p.intraday, secondsVisible: false,
        visible: !p.hideDates,
      },
      localization: {
        locale: 'zh-TW',
        timeFormatter: p.hideDates ? () => '' : (t: unknown) => fmtChartTime(t),
      },
    };
    const charts: IChartApi[] = [];
    const main = createChart(mainRef.current, base);
    charts.push(main);
    const T = p.bars.map((b) => toTime(b.time));
    const line = (s: Series) => s.flatMap((v, i) => (v == null ? [] : [{ time: T[i], value: v }]));

    const candle = main.addCandlestickSeries({
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
      priceFormat: { type: 'price', precision: p.market === 'US' ? 2 : 2, minMove: 0.01 },
    });
    candle.setData(p.bars.map((b, i) => ({ time: T[i], open: b.open, high: b.high, low: b.low, close: b.close })));

    if (p.baseline != null && p.intraday) {
      candle.createPriceLine({ price: p.baseline, color: '#9aa5bb', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '昨收' });
    }

    const vol = main.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 }, visible: false });
    vol.setData(p.bars.map((b, i) => ({ time: T[i], value: b.volume, color: (b.close >= b.open ? up : down) + '66' })));
    const vma = main.addLineSeries({ priceScaleId: 'vol', color: '#f5c54288', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
    vma.setData(line(ind.vma));
    main.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });

    const thin = { lineWidth: 1 as const, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
    if (p.overlays.ma) {
      main.addLineSeries({ ...thin, color: MA_COLORS[5] }).setData(line(ind.ma5));
      main.addLineSeries({ ...thin, color: MA_COLORS[20] }).setData(line(ind.ma20));
      main.addLineSeries({ ...thin, color: MA_COLORS[60] }).setData(line(ind.ma60));
    }
    if (p.overlays.boll) {
      const o = { ...thin, color: '#9aa5bb', lineStyle: LineStyle.Dashed };
      main.addLineSeries(o).setData(line(ind.boll.upper));
      main.addLineSeries({ ...o, lineStyle: LineStyle.Dotted }).setData(line(ind.boll.mid));
      main.addLineSeries(o).setData(line(ind.boll.lower));
    }

    if (p.trades?.length) {
      const markers: SeriesMarker<Time>[] = [];
      for (const t of p.trades) {
        const ts = t.time / 1000;
        let idx = -1;
        for (let i = 0; i < p.bars.length; i++) if (p.bars[i].time <= ts) idx = i;
        if (idx < 0) continue;
        markers.push({
          time: T[idx], position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: t.side === 'buy' ? '#4ea1ff' : '#ff9f43', shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
          text: t.side === 'buy' ? '買' : '賣',
        });
      }
      markers.sort((a, b) => (String(a.time) < String(b.time) ? -1 : String(a.time) > String(b.time) ? 1 : 0));
      candle.setMarkers(markers);
    }

    // 副圖
    let subChart: IChartApi | null = null;
    if (p.sub !== 'none' && subRef.current) {
      subChart = createChart(subRef.current, { ...base, timeScale: { ...base.timeScale, visible: false } });
      charts.push(subChart);
      const sc = subChart;
      const ref = (v: number, color = '#5b6478') => ({ price: v, color, lineWidth: 1 as const, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      if (p.sub === 'rsi') {
        const s = sc.addLineSeries({ color: '#e46cf0', lineWidth: 2, priceLineVisible: false });
        s.setData(line(ind.rsi));
        s.createPriceLine(ref(70, up)); s.createPriceLine(ref(30, down)); s.createPriceLine(ref(50));
      } else if (p.sub === 'kd') {
        sc.addLineSeries({ color: '#f5c542', lineWidth: 2, priceLineVisible: false, title: 'K' }).setData(line(ind.kd.K));
        const d = sc.addLineSeries({ color: '#4ea1ff', lineWidth: 2, priceLineVisible: false, title: 'D' });
        d.setData(line(ind.kd.D));
        d.createPriceLine(ref(80, up)); d.createPriceLine(ref(20, down));
      } else if (p.sub === 'macd') {
        const h = sc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
        h.setData(ind.macd.hist.flatMap((v, i) => (v == null ? [] : [{ time: T[i], value: v, color: v >= 0 ? up : down }])));
        sc.addLineSeries({ color: '#f5c542', lineWidth: 1, priceLineVisible: false, title: 'DIF' }).setData(line(ind.macd.dif));
        sc.addLineSeries({ color: '#4ea1ff', lineWidth: 1, priceLineVisible: false, title: 'DEA' }).setData(line(ind.macd.dea));
      } else if (p.sub === 'obv') {
        sc.addLineSeries({ color: '#4ea1ff', lineWidth: 2, priceLineVisible: false, priceFormat: { type: 'volume' } }).setData(line(ind.obv));
      }
      // 同步兩張圖的捲動縮放
      let syncing = false;
      const link = (a: IChartApi, b: IChartApi) =>
        a.timeScale().subscribeVisibleLogicalRangeChange((r: LogicalRange | null) => {
          if (!r || syncing) return;
          syncing = true; b.timeScale().setVisibleLogicalRange(r); syncing = false;
        });
      link(main, sc); link(sc, main);
    }

    if (p.visibleBars && p.bars.length > p.visibleBars) {
      main.timeScale().setVisibleLogicalRange({ from: p.bars.length - p.visibleBars, to: p.bars.length + 2 });
    } else {
      main.timeScale().fitContent();
    }
    subChart?.timeScale().setVisibleLogicalRange(main.timeScale().getVisibleLogicalRange()!);

    main.subscribeCrosshairMove((param) => {
      if (!param.time || param.logical == null || !param.point) { setLegend(null); return; }
      const i = Math.round(param.logical);
      if (p.bars[i]) setLegend({ bar: p.bars[i], i, x: param.point.x });
      else setLegend(null);
    });

    return () => charts.forEach((c) => c.remove());
  }, [p.bars, p.overlays.ma, p.overlays.boll, p.sub, p.redUp, p.trades, toTime, ind, p.visibleBars, p.hideDates, p.market, p.intraday, p.baseline]);

  const li = legend?.i ?? p.bars.length - 1;
  const lb = legend?.bar ?? p.bars[p.bars.length - 1];
  const prev = p.bars[li - 1];
  const v = (s: Series) => (s[li] == null ? '—' : fmtPrice(s[li]!, p.market));
  const subLegend = () => {
    const f = (x: number | null | undefined, d = 1) => (x == null ? '—' : x.toFixed(d));
    switch (p.sub) {
      case 'rsi': return <>RSI(14) <b style={{ color: '#e46cf0' }}>{f(ind.rsi[li])}</b></>;
      case 'kd': return <>K <b style={{ color: '#f5c542' }}>{f(ind.kd.K[li])}</b> D <b style={{ color: '#4ea1ff' }}>{f(ind.kd.D[li])}</b></>;
      case 'macd': return <>DIF <b style={{ color: '#f5c542' }}>{f(ind.macd.dif[li], 2)}</b> DEA <b style={{ color: '#4ea1ff' }}>{f(ind.macd.dea[li], 2)}</b> 柱 <b>{f(ind.macd.hist[li], 2)}</b></>;
      case 'obv': return <>OBV <b>{fmtVol(ind.obv[li] ?? 0, p.market)}</b></>;
      default: return null;
    }
  };

  if (!p.bars.length) return <div className="chart-empty">沒有資料</div>;
  const chg = prev ? lb.close / prev.close - 1 : 0;
  // 游標標籤：1 日圖以昨收為基準，其餘以前一根 K 線收盤為基準
  const base = p.baseline != null && p.intraday ? p.baseline : prev?.close;
  const tipChg = base ? lb.close - base : 0;
  const tipPct = base ? tipChg / base : 0;
  const boxW = mainRef.current?.clientWidth ?? 600;
  const tipLeft = legend ? Math.min(Math.max(legend.x, 118), Math.max(118, boxW - 118 - 56)) : 0;
  return (
    <div className="chart-wrap">
      <div className="legend">
        {!p.hideDates && <span>{p.intraday ? new Date((lb.time + p.gmtoffset) * 1000).toISOString().slice(5, 16).replace('T', ' ') : dateStr(lb.time, p.gmtoffset)}</span>}
        <span>開 {fmtPrice(lb.open, p.market)}</span>
        <span>高 {fmtPrice(lb.high, p.market)}</span>
        <span>低 {fmtPrice(lb.low, p.market)}</span>
        <span>收 <b className={chg >= 0 ? 'up' : 'down'}>{fmtPrice(lb.close, p.market)} ({(chg * 100).toFixed(2)}%)</b></span>
        <span>量 {fmtVol(lb.volume, p.market)}</span>
        {p.overlays.ma && (
          <span>
            <i style={{ color: MA_COLORS[5] }}>MA5 {v(ind.ma5)}</i> <i style={{ color: MA_COLORS[20] }}>MA20 {v(ind.ma20)}</i>{' '}
            <i style={{ color: MA_COLORS[60] }}>MA60 {v(ind.ma60)}</i>
          </span>
        )}
      </div>
      <div className="chart-box">
        <div ref={mainRef} className="chart-main" style={{ height: p.height ?? 380 }} />
        {legend && (
          <div className="chart-tip" style={{ left: tipLeft, transform: 'translateX(-50%)' }}>
            {!p.hideDates && <div className="tip-date">{fmtChartTime(toTime(lb.time))}</div>}
            <div className="tip-row">
              <span>價格 <b className={cls(tipChg)}>{fmtPrice(lb.close, p.market)} ({tipChg > 0 ? '+' : ''}{(tipPct * 100).toFixed(2)}%)</b></span>
              <span>成交量 <b>{fmtVol(lb.volume, p.market)}</b></span>
            </div>
            <div className="tip-row">
              <span>開 <b>{fmtPrice(lb.open, p.market)}</b></span>
              <span>高 <b>{fmtPrice(lb.high, p.market)}</b></span>
              <span>低 <b>{fmtPrice(lb.low, p.market)}</b></span>
              <span>漲跌 <b className={cls(tipChg)}>{tipChg > 0 ? '+' : ''}{fmtPrice(tipChg, p.market)}</b></span>
            </div>
          </div>
        )}
      </div>
      {p.sub !== 'none' && (
        <>
          <div className="legend sub">{subLegend()}</div>
          <div ref={subRef} className="chart-sub" />
        </>
      )}
    </div>
  );
}
