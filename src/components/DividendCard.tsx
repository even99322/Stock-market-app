import { useEffect, useState } from 'react';
import { fetchDividends, type Dividend } from '../lib/chips';
import { Help, Stat } from './ui';

/** 股利與除權息（台股） */
export function DividendCard({ code, price }: { code: string; price?: number }) {
  const [list, setList] = useState<Dividend[] | null>(null);
  useEffect(() => { setList(null); fetchDividends(code).then(setList).catch(() => setList([])); }, [code]);
  if (!list || list.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const upcoming = list.filter((d) => d.exDate && d.exDate >= today).sort((a, b) => (a.exDate < b.exDate ? -1 : 1))[0];
  const last12 = list.filter((d) => d.exDate && d.exDate < today && d.exDate >= yearAgo);
  const cash12 = last12.reduce((s, d) => s + d.cash, 0);
  const byYear: Record<string, number> = {};
  for (const d of list) if (d.exDate && d.exDate < today) byYear[d.exDate.slice(0, 4)] = (byYear[d.exDate.slice(0, 4)] || 0) + d.cash;
  const years = Object.keys(byYear).sort().slice(-5);
  return (
    <div className="card">
      <div className="card-title">股利・除權息 <Help id="dividend" /></div>
      {upcoming && (
        <div className="note warn">
          即將除息：{upcoming.exDate}（{upcoming.period}）現金股利 {upcoming.cash.toFixed(2)} 元{upcoming.stock > 0 ? `、股票股利 ${upcoming.stock.toFixed(2)} 元` : ''}。除息日前一個交易日（含）買進才領得到。
        </div>
      )}
      <div className="stats">
        <Stat label="近一年現金股利" value={cash12 > 0 ? `${cash12.toFixed(2)} 元` : '—'} />
        <Stat label="以現價計殖利率" value={cash12 > 0 && price ? `${((cash12 / price) * 100).toFixed(2)}%` : '—'} help="yield" />
        <Stat label="近一年配息次數" value={`${last12.length} 次`} />
        {years.map((y) => <Stat key={y} label={`${y} 年合計`} value={`${byYear[y].toFixed(2)} 元`} />)}
      </div>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead><tr><th>所屬期間</th><th>現金股利</th><th>股票股利</th><th>除權息日</th><th>發放日</th></tr></thead>
          <tbody>
            {list.slice(0, 10).map((d, i) => (
              <tr key={i}><td>{d.period}</td><td>{d.cash ? d.cash.toFixed(2) : '—'}</td><td>{d.stock ? d.stock.toFixed(2) : '—'}</td><td>{d.exDate || '未定'}</td><td>{d.payDate || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">模擬帳戶不會入帳股利；除息當天股價會扣掉股利金額（參考價下調），不是真的下跌。</p>
    </div>
  );
}
