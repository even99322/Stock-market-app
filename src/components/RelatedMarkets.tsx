import { useEffect, useMemo, useState } from 'react';
import { cls, fmtNum, fmtPct, fmtPrice } from '../lib/format';
import { fetchChart } from '../lib/market';
import { relatedMarkets } from '../lib/related';
import { fetchTaifex, type TxQuote } from '../lib/taifex';
import type { ChartData } from '../lib/types';
import { go, Help } from './ui';

function Spark({ c, up }: { c: ChartData; up: boolean }) {
  const v = c.bars.map((b) => b.close);
  if (v.length < 2) return <svg className="spark" />;
  const all = [...v, c.prevClose];
  const max = Math.max(...all), min = Math.min(...all), W = 72, H = 26;
  const y = (x: number) => 2 + ((max - x) / (max - min || 1)) * (H - 4);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * W},${y(x)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <line x1={0} x2={W} y1={y(c.prevClose)} y2={y(c.prevClose)} stroke="var(--muted)" strokeDasharray="2 3" strokeWidth={0.7} />
      <polyline points={pts} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth={1.5} />
    </svg>
  );
}

/** 與這檔股票相關的大盤、匯率、期貨、ETF，和個股同步更新 */
export function RelatedMarkets({ symbol, industry, refreshSec }: { symbol: string; industry?: string; refreshSec: number }) {
  const groups = useMemo(() => relatedMarkets(symbol, industry), [symbol, industry]);
  const [data, setData] = useState<Record<string, ChartData | 'err'>>({});
  const [tx, setTx] = useState<TxQuote[]>([]);
  const syms = groups.flatMap((g) => g.items.map((i) => i.s));

  useEffect(() => {
    const load = (force: boolean) => syms.forEach((s) =>
      fetchChart(s, '1d', force).then((c) => setData((d) => ({ ...d, [s]: c }))).catch(() => setData((d) => ({ ...d, [s]: 'err' }))));
    load(false);
    if (groups.some((g) => g.taifex)) fetchTaifex().then(setTx).catch(() => {});
    const t = setInterval(() => document.visibilityState === 'visible' && load(true), Math.max(30, refreshSec) * 1000);
    return () => clearInterval(t);
  }, [syms.join(','), refreshSec]); // eslint-disable-line

  return (
    <div className="card">
      <div className="card-title">相關市場 <span className="muted small">大盤・匯率・期貨・ETF 同步報價</span><Help id="related" /></div>
      {groups.map((g) => (
        <div key={g.title} className="rel-group">
          <div className="sub-title">{g.title}</div>
          <div className="rel-tiles">
            {g.taifex && tx.map((q) => (
              <div key={q.session} className="rel-tile static" title="期交所每日行情（收盤後更新），沒有即時走勢圖">
                <div className="rel-top"><b>台指期 {q.session}</b><span className={`num ${cls(q.change)}`}>{fmtPct(q.pct / 100)}</span></div>
                <div className="rel-mid"><span className={`rel-price ${cls(q.change)}`}>{fmtNum(q.last)}</span><span className="muted small">{q.date} · {q.month.slice(4)}月</span></div>
                <div className="rel-why">{q.session === '日盤' ? '台股大盤的期貨，常領先現貨反應' : '15:00 後的盤後交易，反映夜間國際股市'}</div>
              </div>
            ))}
            {g.items.map((i) => {
              const c = data[i.s];
              const ok = c && c !== 'err';
              const chg = ok ? c.price - c.prevClose : 0;
              return (
                <button key={i.s} className="rel-tile" onClick={() => go('stock', i.s)}>
                  <div className="rel-top"><b>{i.name}</b>{ok && <span className={`num ${cls(chg)}`}>{fmtPct(c.prevClose ? chg / c.prevClose : 0)}</span>}</div>
                  <div className="rel-mid">
                    <span className={`rel-price ${ok ? cls(chg) : ''}`}>{ok ? fmtPrice(c.price, c.market) : c === 'err' ? '—' : '…'}</span>
                    {ok && <Spark c={c} up={chg >= 0} />}
                  </div>
                  <div className="rel-why">{i.why}{ok && c.demo ? '（示範資料）' : ''}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
