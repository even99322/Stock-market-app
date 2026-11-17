import { useEffect, useMemo, useState } from 'react';
import { go, Seg } from '../components/ui';
import { cls, fmtPct, fmtPrice } from '../lib/format';
import { GLOBAL_CATS, GLOBAL_GROUPS, GLOBAL_PICKS, globalItem, type GItem } from '../lib/global';
import { dataStatus, fetchChart } from '../lib/market';
import { useApp } from '../lib/store';
import type { ChartData } from '../lib/types';

const RANGES = [{ v: '1d', label: '今日' }, { v: '1mo', label: '1月' }, { v: '6mo', label: '6月' }, { v: '1y', label: '1年' }];

/** 小走勢圖：虛線是區間起點（今日模式為昨收） */
function Trend({ v, base, up, w = 150, h = 44 }: { v: number[]; base: number; up: boolean; w?: number; h?: number }) {
  if (v.length < 2) return <div className="g-trend empty muted small">僅日線</div>;
  const all = [...v, base];
  const max = Math.max(...all), min = Math.min(...all);
  const y = (x: number) => 3 + ((max - x) / (max - min || 1)) * (h - 6);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${y(x).toFixed(1)}`).join(' ');
  const col = up ? 'var(--up)' : 'var(--down)';
  return (
    <svg className="g-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1={0} x2={w} y1={y(base)} y2={y(base)} stroke="var(--muted)" strokeDasharray="2 3" strokeWidth={0.7} />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={col} opacity={0.1} />
      <polyline points={pts} fill="none" stroke={col} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Cell = ChartData | 'err' | undefined;

export function GlobalTile({ item, c, range }: { item: GItem; c: Cell; range: string }) {
  const ok = c && c !== 'err';
  const closes = ok ? c.bars.map((b) => b.close) : [];
  // 今日：和昨收比；其他區間：和區間第一根比
  const base = ok ? (range === '1d' ? c.prevClose : closes[0] ?? c.prevClose) : 0;
  const chg = ok ? c.price - base : 0;
  return (
    <button className="g-tile" onClick={() => go('stock', item.s)} title={item.why}>
      <div className="g-top"><b>{item.name}</b>{ok && <span className={`num pill ${cls(chg)}`}>{fmtPct(base ? chg / base : 0)}</span>}</div>
      <div className={`g-price ${ok ? cls(chg) : ''}`}>{ok ? fmtPrice(c.price, c.market, c.digits) : c === 'err' ? '讀取失敗' : '…'}</div>
      {ok && <Trend v={closes} base={base} up={chg >= 0} />}
      <div className="g-why">{item.why}{ok && c.demo ? '（示範資料）' : ''}</div>
    </button>
  );
}

/** 依序抓取（同時最多 6 個請求），避免一次送出幾十個請求 */
function useCharts(syms: string[], range: string, refreshSec: number) {
  const [data, setData] = useState<Record<string, Cell>>({});
  useEffect(() => {
    let dead = false;
    const run = async (force: boolean) => {
      const q = [...syms];
      const worker = async () => {
        for (let s = q.shift(); s && !dead; s = q.shift()) {
          const key = s;
          try { const c = await fetchChart(key, range, force); if (!dead) setData((d) => ({ ...d, [key + '|' + range]: c })); }
          catch { if (!dead) setData((d) => ({ ...d, [key + '|' + range]: 'err' })); }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    };
    run(false);
    const t = setInterval(() => document.visibilityState === 'visible' && run(true), Math.max(60, refreshSec) * 1000);
    return () => { dead = true; clearInterval(t); };
  }, [syms.join(','), range, refreshSec]); // eslint-disable-line
  return (s: string) => data[s + '|' + range];
}

export function GlobalPage() {
  const app = useApp();
  const [range, setRange] = useState(() => localStorage.getItem('stocksim.grange') || '1mo');
  const [tab, setTabRaw] = useState(() => localStorage.getItem('stocksim.gcat') || 'idx');
  const setTab = (t: string) => { setTabRaw(t); localStorage.setItem('stocksim.gcat', t); window.scrollTo(0, 0); };
  useEffect(() => { localStorage.setItem('stocksim.grange', range); }, [range]);
  const groups = useMemo(() => GLOBAL_GROUPS.filter((g) => g.cat === tab), [tab]);
  const get = useCharts(groups.flatMap((g) => g.items.map((i) => i.s)), range, app.settings.refreshSec);

  return (
    <div className="page">
      <div className="page-head">
        <div className="row gap">
          <button className="icon-btn" onClick={() => (history.length > 1 ? history.back() : go('market'))}>←</button>
          <h2>全球市場</h2>
        </div>
        {dataStatus.offline ? <span className="badge warn">離線：示範資料</span> : <span className="badge">延遲報價</span>}
      </div>
      <div className="g-cats">
        {GLOBAL_CATS.map((c) => <button key={c.v} className={tab === c.v ? 'on' : ''} onClick={() => setTab(c.v)}>{c.label}</button>)}
      </div>
      <div className="g-tools">
        <Seg small value={range} onChange={setRange} options={RANGES} />
        <span className="muted small">漲跌幅為所選區間的變化（「今日」為相對昨收）。點任一格看完整 K 線。</span>
      </div>
      {tab === 'stock' && <div className="note">這裡列出各地區的代表公司。其他海外股票可以在「市場」頁搜尋，輸入英文名稱或代號（例如 7203.T、0700.HK、005930.KS、SAP.DE）。海外股票只能看行情，不能模擬下單。</div>}
      {groups.map((g) => (
        <div key={g.id} className="card">
          <div className="card-title">{g.title}{g.note && <span className="muted small">{g.note}</span>}</div>
          <div className="g-tiles">
            {g.items.map((i) => <GlobalTile key={i.s} item={i} c={get(i.s)} range={range} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 市場首頁的摘要卡 */
export function GlobalStrip() {
  const app = useApp();
  const get = useCharts(GLOBAL_PICKS, '1mo', app.settings.refreshSec);
  return (
    <div className="card">
      <div className="card-title">
        全球市場 <span className="muted small">匯率・期貨・商品・利率（近 1 月走勢）</span>
        <button className="btn sm ghost push" onClick={() => go('global')}>查看全部 →</button>
      </div>
      <div className="g-tiles compact">
        {GLOBAL_PICKS.map((s) => { const i = globalItem(s)!; return <GlobalTile key={s} item={i} c={get(s)} range="1mo" />; })}
      </div>
    </div>
  );
}
