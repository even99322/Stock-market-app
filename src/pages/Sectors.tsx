import { useEffect, useMemo, useState } from 'react';
import { go, Help, Seg, Spinner } from '../components/ui';
import { cls, fmtPct, fmtPrice } from '../lib/format';
import { fetchChart, fetchQuote, type Quote } from '../lib/market';
import { THEMES, US_SECTORS, type Theme, type ThemeMember } from '../lib/themes';
import { aggregateSectors, loadTwSnapshot, type TwQuote } from '../lib/twmarket';

type Tab = 'tw' | 'theme' | 'us';
const yi = (v: number) => (v >= 1e12 ? `${(v / 1e12).toFixed(2)} 兆` : `${(v / 1e8).toFixed(v >= 1e10 ? 0 : 1)} 億`);
const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`);

export function SectorsPage() {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('stocksim.sectorTab') as Tab) || 'tw');
  useEffect(() => { localStorage.setItem('stocksim.sectorTab', tab); }, [tab]);
  return (
    <div className="page">
      <div className="page-head">
        <h2>板塊・題材 <Help id="sector" /></h2>
      </div>
      <Seg value={tab} onChange={setTab} options={[{ v: 'tw', label: '台股產業' }, { v: 'theme', label: '熱門題材' }, { v: 'us', label: '美股類股' }]} />
      {tab === 'tw' && <TwSectors />}
      {tab === 'theme' && <Themes />}
      {tab === 'us' && <UsSectors />}
    </div>
  );
}

function useTwSnapshot() {
  const [snap, setSnap] = useState<Awaited<ReturnType<typeof loadTwSnapshot>> | null>(null);
  const [err, setErr] = useState('');
  const load = (force = false) => { setErr(''); loadTwSnapshot(force).then(setSnap).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, []);
  return { snap, err, reload: () => load(true) };
}

function StockRow({ q, rank }: { q: TwQuote; rank?: number }) {
  return (
    <div className="tr sec-stock" onClick={() => go('stock', q.symbol)}>
      <div className="name">
        <b>{rank != null && <span className="muted small">{rank}. </span>}{q.name}</b>
        <span className="muted small">{q.code}{q.market === 'tpex' ? ' 櫃' : ''}</span>
      </div>
      <div className="num">{fmtPrice(q.close, 'TW')}</div>
      <div className={`num ${cls(q.change)}`}>{fmtPct(q.changePct / 100)}</div>
      <div className="num">{yi(q.value)}<button className="mini-link" onClick={(e) => { e.stopPropagation(); go('company', q.symbol); }}>分析</button></div>
    </div>
  );
}

function TwSectors() {
  const { snap, err, reload } = useTwSnapshot();
  const [sort, setSort] = useState<'value' | 'chg'>('value');
  const [open, setOpen] = useState<string | null>(null);
  const sectors = useMemo(() => (snap ? aggregateSectors(snap.quotes, snap.industry) : []), [snap]);
  const sorted = useMemo(() => [...sectors].sort((a, b) => (sort === 'value' ? b.value - a.value : b.changePct - a.changePct)), [sectors, sort]);
  const total = snap?.quotes.reduce((a, q) => a + q.value, 0) ?? 0;
  const top = useMemo(() => (snap ? [...snap.quotes].sort((a, b) => b.value - a.value).slice(0, 10) : []), [snap]);

  if (err) return <div className="card err">{err}<button className="btn sm" onClick={reload}>重試</button></div>;
  if (!snap) return <div className="center"><Spinner /></div>;
  const maxV = sectors[0]?.value || 1;
  return (
    <>
      <div className="card">
        <div className="row gap wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="muted small">資料日期 {snap.date || '—'}（上市＋上櫃普通股，收盤後更新）</div>
            <div>全市場成交金額 <b>{yi(total)}</b> 元</div>
          </div>
          <div className="row gap">
            <Seg small value={sort} onChange={setSort} options={[{ v: 'value', label: '依成交金額' }, { v: 'chg', label: '依漲跌幅' }]} />
            <button className="btn sm ghost" onClick={reload}>更新</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">個股成交金額前 10 名</div>
        <div className="table">{top.map((q, i) => <StockRow key={q.code} q={q} rank={i + 1} />)}</div>
      </div>

      <div className="card">
        <div className="card-title">產業排行 <span className="muted small">點開看該產業成交最大的股票</span></div>
        <div className="sectors">
          {sorted.map((s, i) => (
            <div key={s.name} className={`sector ${open === s.name ? 'open' : ''}`}>
              <button className="sector-head" onClick={() => setOpen(open === s.name ? null : s.name)}>
                <span className="rank">{i + 1}</span>
                <span className="sec-name"><b>{s.name}</b><span className="muted small">{s.count} 檔 · 漲 {s.up} / 跌 {s.down}</span></span>
                <span className="sec-bar"><i style={{ width: `${(s.value / maxV) * 100}%` }} /></span>
                <span className="num sec-val">{yi(s.value)}<span className="muted small">{fmtPct(s.share, false, 1)}</span></span>
                <span className={`num sec-chg ${cls(s.changePct)}`}>{fmtPct(s.changePct / 100)}</span>
              </button>
              {open === s.name && (
                <div className="table sector-body">
                  <div className="tr th"><div>股票</div><div className="num">收盤</div><div className="num">漲跌</div><div className="num">成交金額</div></div>
                  {s.stocks.slice(0, 15).map((q, k) => <StockRow key={q.code} q={q} rank={k + 1} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Themes() {
  const { snap } = useTwSnapshot();
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const qmap = new Map(snap?.quotes.map((q) => [q.code, q]) || []);
    return THEMES.map((t) => {
      const tw = t.tw.map((m) => ({ m, q: qmap.get(m.code) }));
      const value = tw.reduce((a, x) => a + (x.q?.value ?? 0), 0);
      const chg = value ? tw.reduce((a, x) => a + (x.q ? x.q.changePct * x.q.value : 0), 0) / value : 0;
      return { t, tw, value, chg };
    }).sort((a, b) => b.value - a.value);
  }, [snap]);
  return (
    <>
      <p className="muted small">題材是跨產業的概念分類（人工整理）。排序依今日台股成分股成交金額合計。<Help id="theme" /></p>
      {rows.map(({ t, tw, value, chg }) => (
        <div key={t.id} className="card theme">
          <button className="theme-head" onClick={() => setOpen(open === t.id ? null : t.id)}>
            <div className="grow">
              <div className="card-title">{t.name}</div>
              <div className="muted small">{t.desc}</div>
            </div>
            {value > 0 && <div className="num"><div>{yi(value)}</div><div className={`small ${cls(chg)}`}>{fmtPct(chg / 100)}</div></div>}
          </button>
          {open === t.id ? (
            <ThemeBody t={t} tw={tw} />
          ) : (
            <div className="chips">
              {t.tw.map((m) => <span key={m.code} className="chip">{m.name}</span>)}
              {t.us.map((m) => <span key={m.code} className="chip us">{m.code}</span>)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function ThemeBody({ t, tw }: { t: Theme; tw: { m: ThemeMember; q?: TwQuote }[] }) {
  const usQ = useUsQuotes(t.us.map((m) => m.code));
  const sym = (code: string, q?: TwQuote) => q?.symbol || `${code}.TW`;
  return (
    <div className="table">
      {tw.sort((a, b) => (b.q?.value ?? 0) - (a.q?.value ?? 0)).map(({ m, q }) => (
        <div key={m.code} className="tr" onClick={() => go('stock', sym(m.code, q))}>
          <div className="name"><b>{m.name}</b><span className="muted small">{m.code}{m.role ? ` · ${m.role}` : ''}</span></div>
          <div className="num">{q ? fmtPrice(q.close, 'TW') : '—'}</div>
          <div className={`num ${q ? cls(q.change) : ''}`}>{q ? fmtPct(q.changePct / 100) : ''}</div>
          <div className="num">{q ? yi(q.value) : ''}<button className="mini-link" onClick={(e) => { e.stopPropagation(); go('company', sym(m.code, q)); }}>分析</button></div>
        </div>
      ))}
      {t.us.map((m) => {
        const q = usQ[m.code];
        return (
          <div key={m.code} className="tr" onClick={() => go('stock', m.code)}>
            <div className="name"><b>{m.name} <span className="tag US">美</span></b><span className="muted small">{m.code}{m.role ? ` · ${m.role}` : ''}</span></div>
            <div className="num">{q ? fmtPrice(q.price, 'US') : '…'}</div>
            <div className={`num ${q ? cls(q.change) : ''}`}>{q ? fmtPct(q.changePct / 100) : ''}</div>
            <div className="num"><button className="mini-link" onClick={(e) => { e.stopPropagation(); go('company', m.code); }}>分析</button></div>
          </div>
        );
      })}
    </div>
  );
}

function useUsQuotes(syms: string[]) {
  const [q, setQ] = useState<Record<string, Quote>>({});
  useEffect(() => {
    syms.forEach((s) => fetchQuote(s).then((x) => setQ((c) => ({ ...c, [s]: x }))).catch(() => {}));
  }, [syms.join(',')]); // eslint-disable-line
  return q;
}

function UsSectors() {
  const [data, setData] = useState<Record<string, { dollar: number; chg: number; price: number; demo: boolean }>>({});
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    US_SECTORS.forEach((s) =>
      fetchChart(s.etf, '1d').then((c) => {
        const vol = c.bars.reduce((a, b) => a + b.volume, 0);
        setData((d) => ({ ...d, [s.etf]: { dollar: vol * c.price, chg: c.prevClose ? c.price / c.prevClose - 1 : 0, price: c.price, demo: c.demo } }));
      }).catch(() => {}),
    );
  }, []);
  const rows = [...US_SECTORS].sort((a, b) => (data[b.etf]?.dollar ?? 0) - (data[a.etf]?.dollar ?? 0));
  const maxV = Math.max(1, ...Object.values(data).map((d) => d.dollar));
  return (
    <>
      <p className="muted small">以 SPDR 類股 ETF 的當日成交金額（成交量 × 價格）代表各類股熱度。點開看主要成分股（大約，依 ETF 權重）。</p>
      <div className="card">
        <div className="sectors">
          {rows.map((s, i) => {
            const d = data[s.etf];
            return (
              <div key={s.etf} className={`sector ${open === s.etf ? 'open' : ''}`}>
                <button className="sector-head" onClick={() => setOpen(open === s.etf ? null : s.etf)}>
                  <span className="rank">{i + 1}</span>
                  <span className="sec-name"><b>{s.name}</b><span className="muted small">{s.etf} · {s.desc}</span></span>
                  <span className="sec-bar"><i style={{ width: `${((d?.dollar ?? 0) / maxV) * 100}%` }} /></span>
                  <span className="num sec-val">{d ? usd(d.dollar) : '…'}</span>
                  <span className={`num sec-chg ${d ? cls(d.chg) : ''}`}>{d ? fmtPct(d.chg) : ''}</span>
                </button>
                {open === s.etf && <UsHoldings syms={s.holdings} etf={s.etf} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function UsHoldings({ syms, etf }: { syms: ThemeMember[]; etf: string }) {
  const q = useUsQuotes(syms.map((m) => m.code));
  return (
    <div className="table sector-body">
      <div className="tr" onClick={() => go('stock', etf)}>
        <div className="name"><b>{etf}（類股 ETF）</b><span className="muted small">直接買整個類股</span></div><div /><div /><div />
      </div>
      {syms.map((m) => {
        const x = q[m.code];
        return (
          <div key={m.code} className="tr" onClick={() => go('stock', m.code)}>
            <div className="name"><b>{m.name}</b><span className="muted small">{m.code}</span></div>
            <div className="num">{x ? fmtPrice(x.price, 'US') : '…'}</div>
            <div className={`num ${x ? cls(x.change) : ''}`}>{x ? fmtPct(x.changePct / 100) : ''}</div>
            <div className="num"><button className="mini-link" onClick={(e) => { e.stopPropagation(); go('company', m.code); }}>分析</button></div>
          </div>
        );
      })}
    </div>
  );
}
