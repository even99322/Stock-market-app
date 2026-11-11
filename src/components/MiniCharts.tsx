// 財報用的簡單 SVG 圖表（長條、折線），手機與電腦都能清楚顯示
import { useEffect, useRef, useState } from 'react';

/** 量測容器寬度，讓 SVG 以實際像素繪製（文字不變形） */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(200, Math.round(e[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface BarSeries { name: string; color: string; values: (number | null | undefined)[]; /** 正值用漲色、負值用跌色（買賣超） */ sign?: boolean }

const fmtShort = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(1) + '兆';
  if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e10 ? 0 : 1) + '億';
  if (a >= 1e4) return (v / 1e4).toFixed(0) + '萬';
  return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(0);
};

/** 分組長條圖。format 用於數值標籤；percent=true 時值為比率 */
export function BarChart({ labels, series, height = 200, format = fmtShort, sub }: {
  labels: string[]; series: BarSeries[]; height?: number; format?: (v: number) => string;
  /** 每根下方的小字（例如年增率） */
  sub?: (string | null)[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
  if (!all.length) return <div className="muted pad small">沒有資料</div>;
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const H = height, padT = 18, padB = sub ? 34 : 22, padL = 4, padR = 4;
  const n = labels.length;
  const gw = (W - padL - padR) / n;
  const bw = Math.min(28, (gw * 0.75) / series.length);
  const y = (v: number) => padT + ((max - v) / (max - min || 1)) * (H - padT - padB);
  const zero = y(0);
  const step = Math.max(1, Math.ceil(44 / gw));
  const showLb = (i: number) => (n - 1 - i) % step === 0;
  return (
    <div className="mini-chart" ref={ref}>
      <div className="mini-legend">
        {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        {hover != null && (
          <b className="mini-hover">
            {labels[hover]}：{series.map((s) => `${s.name} ${s.values[hover] != null ? format(s.values[hover]!) : '—'}`).join('　')}
          </b>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--line)" />
        {labels.map((lb, i) => {
          const gx = padL + i * gw + (gw - bw * series.length) / 2;
          return (
            <g key={lb + i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={padL + i * gw} y={0} width={gw} height={H} fill={hover === i ? 'rgba(255,255,255,0.04)' : 'transparent'} />
              {series.map((s, k) => {
                const v = s.values[i];
                if (v == null || !Number.isFinite(v)) return null;
                const top = Math.min(y(v), zero), h = Math.max(1, Math.abs(y(v) - zero));
                return <rect key={s.name} x={gx + k * bw} y={top} width={bw - 2} height={h} rx={2} fill={s.sign ? (v < 0 ? 'var(--down)' : 'var(--up)') : v < 0 ? '#9aa5bb' : s.color} />;
              })}
              {showLb(i) && <text x={padL + i * gw + gw / 2} y={H - (sub ? 20 : 6)} textAnchor="middle" fontSize={11} fill="var(--muted)">{lb}</text>}
              {showLb(i) && sub?.[i] && <text x={padL + i * gw + gw / 2} y={H - 5} textAnchor="middle" fontSize={10} fill={sub[i]!.startsWith('-') ? 'var(--down)' : 'var(--up)'}>{sub[i]}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 折線圖（比率） */
export function LinesChart({ labels, series, height = 180, format = (v: number) => (v * 100).toFixed(1) + '%' }: {
  labels: string[]; series: BarSeries[]; height?: number; format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
  if (!all.length) return <div className="muted pad small">沒有資料</div>;
  let max = Math.max(...all), min = Math.min(...all);
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.1 || 0.01;
  max += pad; min -= pad;
  const H = height, padT = 10, padB = 22;
  const n = labels.length;
  const x = (i: number) => (n === 1 ? W / 2 : 14 + (i * (W - 28)) / (n - 1));
  const y = (v: number) => padT + ((max - v) / (max - min || 1)) * (H - padT - padB);
  const step = Math.max(1, Math.ceil(44 / (W / n)));
  return (
    <div className="mini-chart" ref={ref}>
      <div className="mini-legend">
        {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        {hover != null && (
          <b className="mini-hover">{labels[hover]}：{series.map((s) => `${s.name} ${s.values[hover] != null ? format(s.values[hover]!) : '—'}`).join('　')}</b>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
        {min < 0 && max > 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" />}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null || !Number.isFinite(v) ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={2.5} />;
        })}
        {series.map((s) => s.values.map((v, i) => (v == null ? null : <circle key={s.name + i} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 2.5} fill={s.color} />)))}
        {labels.map((lb, i) => (
          <g key={lb + i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <rect x={x(i) - (W / n) / 2} y={0} width={W / n} height={H} fill="transparent" />
            {(n - 1 - i) % step === 0 && <text x={x(i)} y={H - 5} textAnchor="middle" fontSize={11} fill="var(--muted)">{lb}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}
