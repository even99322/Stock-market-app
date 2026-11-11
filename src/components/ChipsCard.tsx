import { useEffect, useMemo, useState } from 'react';
import { analyzeChips, fetchChips, type Chips } from '../lib/chips';
import { fmtNum } from '../lib/format';
import { BarChart, LinesChart } from './MiniCharts';
import { Help, Seg, Spinner, Stat } from './ui';

type Who = 'total' | 'foreign' | 'trust' | 'dealer';
const WHO: { v: Who; label: string }[] = [{ v: 'total', label: '合計' }, { v: 'foreign', label: '外資' }, { v: 'trust', label: '投信' }, { v: 'dealer', label: '自營商' }];

/** 籌碼面：三大法人買賣超、融資融券（台股） */
export function ChipsCard({ code, priceChg20 }: { code: string; priceChg20?: number }) {
  const [data, setData] = useState<Chips | null>(null);
  const [err, setErr] = useState('');
  const [who, setWho] = useState<Who>('total');
  useEffect(() => {
    setData(null); setErr('');
    fetchChips(code).then(setData).catch((e) => setErr(e?.message || String(e)));
  }, [code]);
  const insights = useMemo(() => (data ? analyzeChips(data, priceChg20) : []), [data, priceChg20]);

  if (err) return <div className="card"><div className="card-title">籌碼面 <Help id="chips" /></div><div className="muted small">無法取得籌碼資料（{err}）</div></div>;
  if (!data) return <div className="card"><div className="card-title">籌碼面 <Help id="chips" /></div><Spinner /></div>;
  const inst = data.inst.slice(-30);
  const labels = inst.map((d) => d.date.slice(5).replace('-', '/'));
  const L = data.inst[data.inst.length - 1];
  const M = data.margin[data.margin.length - 1];
  const mg = data.margin.slice(-30);
  const sgn = (x: number) => `${x > 0 ? '+' : ''}${fmtNum(Math.round(x))}`;
  const c = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
  return (
    <div className="card">
      <div className="card-title">籌碼面 <span className="muted small">三大法人・融資融券（{L.date.slice(5).replace('-', '/')}，單位：張）</span><Help id="chips" /></div>
      <div className="stats">
        <Stat label="外資買賣超" value={sgn(L.foreign)} className={c(L.foreign)} />
        <Stat label="投信買賣超" value={sgn(L.trust)} className={c(L.trust)} />
        <Stat label="自營商買賣超" value={sgn(L.dealer)} className={c(L.dealer)} />
        <Stat label="三大法人合計" value={sgn(L.total)} className={c(L.total)} />
        {M && <Stat label="融資餘額" value={fmtNum(M.margin)} help="margin" />}
        {M && <Stat label="融券餘額" value={fmtNum(M.short)} help="margin" />}
        {M && M.margin > 0 && <Stat label="券資比" value={`${((M.short / M.margin) * 100).toFixed(1)}%`} help="margin" />}
        {data.foreignRatio.length > 0 && <Stat label="外資持股" value={`${data.foreignRatio[data.foreignRatio.length - 1].ratio.toFixed(2)}%`} />}
      </div>
      <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
        <span className="sub-title">每日買賣超（近 {inst.length} 個交易日）</span>
        <Seg small value={who} onChange={setWho} options={WHO} />
      </div>
      <BarChart height={170} labels={labels} format={(v) => `${v > 0 ? '+' : ''}${fmtNum(Math.round(v))} 張`}
        series={[{ name: WHO.find((w) => w.v === who)!.label, color: 'var(--up)', sign: true, values: inst.map((d) => d[who]) }]} />
      {mg.length > 1 && (
        <>
          <span className="sub-title">融資餘額走勢 <Help id="margin" /></span>
          <LinesChart height={130} labels={mg.map((d) => d.date.slice(5).replace('-', '/'))} format={(v) => `${fmtNum(v)} 張`}
            series={[{ name: '融資餘額', color: '#f5c542', values: mg.map((d) => d.margin) }]} />
        </>
      )}
      {insights.length > 0 && (
        <ul className="insights">{insights.map((x, i) => <li key={i} className={x.tone}>{x.text}</li>)}</ul>
      )}
    </div>
  );
}
