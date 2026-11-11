import { useCallback, useEffect, useState } from 'react';
import { SymbolSearch } from '../components/SymbolSearch';
import { go, Help, Spinner } from '../components/ui';
import { cls, fmtPct, fmtPrice } from '../lib/format';
import { dataStatus, fetchQuote, type Quote } from '../lib/market';
import { lookupName } from '../lib/names';
import { store, useApp } from '../lib/store';

const INDICES = ['^TWII', '^GSPC', '^IXIC'];

export function MarketPage() {
  const app = useApp();
  const [quotes, setQuotes] = useState<Record<string, Quote | 'err'>>({});
  const [loading, setLoading] = useState(false);
  const syms = [...new Set([...INDICES, ...app.watchlist])];

  const load = useCallback(async (force = false) => {
    setLoading(true);
    await Promise.all(
      syms.map(async (s) => {
        try {
          const q = await fetchQuote(s, force);
          setQuotes((cur) => ({ ...cur, [s]: q }));
        } catch {
          setQuotes((cur) => ({ ...cur, [s]: 'err' }));
        }
      }),
    );
    setLoading(false);
  }, [syms.join(',')]); // eslint-disable-line

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(true), app.settings.refreshSec * 1000);
    return () => clearInterval(t);
  }, [load, app.settings.refreshSec]);

  const remove = (s: string) => store.update((st) => ({ ...st, watchlist: st.watchlist.filter((x) => x !== s) }));
  const move = (s: string, d: number) =>
    store.update((st) => {
      const w = [...st.watchlist];
      const i = w.indexOf(s), j = i + d;
      if (i < 0 || j < 0 || j >= w.length) return st;
      [w[i], w[j]] = [w[j], w[i]];
      return { ...st, watchlist: w };
    });

  return (
    <div className="page">
      <div className="page-head">
        <h2>市場</h2>
        <div className="row gap">
          {dataStatus.offline ? <span className="badge warn">離線：示範資料</span> : <span className="badge">延遲報價</span>}
          <button className="btn sm" onClick={() => load(true)} disabled={loading}>{loading ? '更新中…' : '重新整理'}</button>
        </div>
      </div>
      <SymbolSearch onPick={(s) => go('stock', s.symbol)} />

      <div className="index-cards">
        {INDICES.map((s) => {
          const q = quotes[s];
          return (
            <button key={s} className="card index-card" onClick={() => go('stock', s)}>
              <div className="muted small">{lookupName(s)}</div>
              {q && q !== 'err' ? (
                <>
                  <div className={`big ${cls(q.change)}`}>{fmtPrice(q.price, 'US')}</div>
                  <div className={`small ${cls(q.change)}`}>{q.change > 0 ? '▲' : q.change < 0 ? '▼' : ''} {fmtPrice(Math.abs(q.change), 'US')} ({fmtPct(q.changePct / 100)})</div>
                </>
              ) : q === 'err' ? <div className="muted">讀取失敗</div> : <Spinner />}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">自選股 <span className="muted small">（在個股頁按 ☆ 加入）</span><Help id="change" /></div>
        <div className="table watch">
          {app.watchlist.filter((s) => !INDICES.includes(s)).map((s) => {
            const q = quotes[s];
            const ok = q && q !== 'err';
            return (
              <div key={s} className="tr" onClick={() => go('stock', s)}>
                <div className="name">
                  <b>{ok ? q.name : lookupName(s) || s}</b>
                  <span className="muted small">{s.replace(/\.(TW|TWO)$/, '')} {s.endsWith('.TWO') ? '櫃' : ''}{ok && q.isOpen ? ' · 交易中' : ''}</span>
                </div>
                <div className={`num ${ok ? cls(q.change) : ''}`}>{ok ? fmtPrice(q.price, q.market) : q === 'err' ? '—' : '…'}</div>
                <div className={`num pill ${ok ? cls(q.change) : ''}`}>{ok ? fmtPct(q.changePct / 100) : ''}</div>
                <div className="ops" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => move(s, -1)} title="上移">↑</button>
                  <button className="icon-btn" onClick={() => remove(s)} title="移除">✕</button>
                </div>
              </div>
            );
          })}
          {app.watchlist.filter((s) => !INDICES.includes(s)).length === 0 && <div className="muted pad">還沒有自選股，用上方搜尋找一檔吧。</div>}
        </div>
      </div>
    </div>
  );
}
