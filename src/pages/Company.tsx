import { useEffect, useMemo, useState } from 'react';
import { BarChart, LinesChart } from '../components/MiniCharts';
import { NewsList } from '../components/NewsList';
import { go, Help, Seg, Spinner, Stat } from '../components/ui';
import { analyze, computeRatios, fetchFinancials, margins, type Financials, type FinPeriod } from '../lib/financials';
import { cls, fmtPct, fmtPrice } from '../lib/format';
import { fetchQuote, type Quote } from '../lib/market';
import { getFundamental, loadTwData, lookupName } from '../lib/names';
import { profileOf } from '../lib/profiles';
import { themesOf, usSectorOf } from '../lib/themes';
import { industryOf, loadTwSnapshot, type TwQuote } from '../lib/twmarket';
import { fetchWiki, type WikiSummary } from '../lib/wiki';

const isTw = (s: string) => /\.(TW|TWO)$/.test(s);
const yi = (v: number | undefined, cur: string) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const x = v / 1e8;
  return `${cur === 'USD' ? 'US$' : ''}${x.toLocaleString('zh-TW', { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 1 })} 億`;
};

export function CompanyPage({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fin, setFin] = useState<Financials | null>(null);
  const [finErr, setFinErr] = useState('');
  const [wiki, setWiki] = useState<WikiSummary | null | undefined>(undefined);
  const [peers, setPeers] = useState<TwQuote[]>([]);
  const [industry, setIndustry] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const tw = isTw(symbol);
  const prof = profileOf(symbol);
  const name = quote?.name || lookupName(symbol) || symbol;

  useEffect(() => {
    setFin(null); setFinErr(''); setWiki(undefined);
    fetchQuote(symbol).then(setQuote).catch(() => {});
    fetchFinancials(symbol).then(setFin).catch((e) => setFinErr(e.message || String(e)));
    if (tw) {
      loadTwData().then(() => setTick((x) => x + 1));
      loadTwSnapshot().then((snap) => {
        const code = symbol.split('.')[0];
        const ind = snap.industry[code];
        setIndustry(ind);
        if (ind) setPeers(snap.quotes.filter((q) => snap.industry[q.code] === ind && q.code !== code).sort((a, b) => b.value - a.value).slice(0, 8));
      }).catch(() => {});
    }
  }, [symbol]); // eslint-disable-line

  // 沒有人工整理的簡介時，抓維基百科
  useEffect(() => {
    if (prof || !name || name === symbol && tw) { setWiki(null); return; }
    const q = tw ? `${name} 公司` : `${name}`;
    const code = symbol.split('.')[0];
    // 台股：內文要提到公司簡稱或代號；美股：要提到英文名稱第一個字或代號
    const must = tw ? [name.replace(/-KY$|\*$/, ''), code] : [name.split(/[\s,.]/)[0], symbol];
    fetchWiki(q, must).then(setWiki);
  }, [name]); // eslint-disable-line

  const ratios = useMemo(() => (fin ? computeRatios(fin) : null), [fin]);
  const insights = useMemo(() => (fin && ratios ? analyze(fin, ratios) : []), [fin, ratios]);
  const themes = themesOf(symbol);
  const usSec = !tw ? usSectorOf(symbol) : undefined;
  const fund = tw ? getFundamental(quote?.symbol || symbol) : undefined;
  const pe = fund?.pe ?? (quote && !quote.demo && ratios?.epsTtm && ratios.epsTtm > 0 ? quote.price / ratios.epsTtm : undefined);
  const cur = fin?.currency || (tw ? 'TWD' : 'USD');
  void tick;

  return (
    <div className="page">
      <div className="stock-head">
        <button className="icon-btn" onClick={() => (history.length > 1 ? history.back() : go('sectors'))}>←</button>
        <div className="grow">
          <h2>{name} <span className="muted small">{symbol}</span></h2>
          <div className="muted small">
            {industry || industryOf(symbol.split('.')[0]) || (usSec ? `美股 · ${usSec.name}` : '')}
            {quote && <> · <span className={cls(quote.change)}>{fmtPrice(quote.price, quote.market)} ({fmtPct(quote.changePct / 100)})</span></>}
          </div>
        </div>
        <button className="btn sm ghost" onClick={() => go('stock', symbol)}>📈 線圖・交易</button>
      </div>

      {/* ---------- 業務與關聯 ---------- */}
      <div className="card">
        <div className="card-title">公司業務 <Help id="theme" /></div>
        {prof ? (
          <>
            <p className="biz">{prof.biz}</p>
            <div className="kv biz-kv">
              {prof.chain && <><span>產業鏈位置</span><div>{prof.chain}</div></>}
              {prof.segments && <><span>營收結構</span><div>{prof.segments}</div></>}
              {prof.customers && <><span>主要客戶</span><div>{prof.customers}</div></>}
              {prof.competitors && <><span>競爭對手</span><div>{prof.competitors}</div></>}
            </div>
            <div className="sub-title">觀察重點</div>
            <ul className="drivers">{prof.drivers.map((d) => <li key={d}>{d}</li>)}</ul>
          </>
        ) : wiki === undefined ? <Spinner /> : wiki ? (
          <>
            <p className="biz">{wiki.extract}</p>
            <div className="muted small">來源：維基百科《<a href={wiki.url} target="_blank" rel="noreferrer">{wiki.title}</a>》（自動搜尋，若不是這家公司請以官方資料為準）</div>
          </>
        ) : (
          <p className="muted">目前沒有這家公司的業務簡介，可參考下方產業分類、同業與財報判斷。</p>
        )}
        {(themes.length > 0 || industry || usSec) && (
          <div className="chips">
            {industry && <span className="chip strong" onClick={() => go('sectors')}>產業：{industry}</span>}
            {usSec && <span className="chip strong" onClick={() => go('stock', usSec.etf)}>類股：{usSec.name}（{usSec.etf}）</span>}
            {themes.map((t) => <span key={t.id} className="chip" onClick={() => go('sectors')}>題材：{t.name}</span>)}
          </div>
        )}
      </div>

      {(prof?.related.length || peers.length > 0) && (
        <div className="card">
          <div className="card-title">關聯公司</div>
          {prof?.related.length ? (
            <div className="table">
              {prof.related.map((x) => (
                <div key={x.s} className="tr rel" onClick={() => go('company', x.s)}>
                  <div className="name"><b>{x.name}</b><span className="muted small">{x.s}</span></div>
                  <div className="rel-why">{x.why}</div>
                </div>
              ))}
            </div>
          ) : null}
          {peers.length > 0 && (
            <>
              <div className="sub-title">同產業（{industry}）今日成交金額前幾名</div>
              <div className="table">
                {peers.map((q) => (
                  <div key={q.code} className="tr" onClick={() => go('company', q.symbol)}>
                    <div className="name"><b>{q.name}</b><span className="muted small">{q.code}</span></div>
                    <div className="num">{fmtPrice(q.close, 'TW')}</div>
                    <div className={`num ${cls(q.change)}`}>{fmtPct(q.changePct / 100)}</div>
                    <div className="num">{(q.value / 1e8).toFixed(1)} 億</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {themes.flatMap((t) => [...t.tw.map((m) => ({ ...m, sym: `${m.code}.TW`, tw: true })), ...t.us.map((m) => ({ ...m, sym: m.code, tw: false }))])
            .filter((m, i, a) => m.sym.split('.')[0] !== symbol.split('.')[0] && a.findIndex((x) => x.code === m.code) === i).length > 0 && (
            <>
              <div className="sub-title">同題材公司</div>
              <div className="chips">
                {themes.flatMap((t) => [...t.tw.map((m) => ({ ...m, sym: `${m.code}.TW` })), ...t.us.map((m) => ({ ...m, sym: m.code }))])
                  .filter((m, i, a) => m.code !== symbol.split('.')[0] && a.findIndex((x) => x.code === m.code) === i)
                  .map((m) => <span key={m.code} className="chip" onClick={() => go('company', m.sym)}>{m.name}</span>)}
              </div>
            </>
          )}
        </div>
      )}

      <NewsList symbol={symbol} name={name} limit={6} />

      {/* ---------- 財報 ---------- */}
      {finErr && <div className="card err">財報：{finErr}</div>}
      {!fin && !finErr && <div className="card center"><Spinner /><span className="muted small">讀取財報…</span></div>}
      {fin && ratios && (
        <>
          <div className="card">
            <div className="card-title">財報重點 <span className="muted small">最新一季 {fin.quarters[fin.quarters.length - 1]?.key}（{cur === 'USD' ? '美元' : '新台幣'}）</span></div>
            <div className="stats">
              <Stat label="單季營收" value={yi(fin.quarters[fin.quarters.length - 1]?.revenue, cur)} help="revenue" />
              <Stat label="營收年增" value={fmtPct(ratios.revYoy)} className={cls(ratios.revYoy)} help="revenue" />
              {!fin.financialCo && <Stat label="毛利率" value={fmtPct(ratios.grossMargin, false, 1)} help="margins" />}
              <Stat label="營業利益率" value={fmtPct(ratios.opMargin, false, 1)} help="margins" />
              <Stat label="淨利率" value={fmtPct(ratios.netMargin, false, 1)} help="margins" />
              <Stat label="近四季 EPS" value={ratios.epsTtm?.toFixed(2) ?? '—'} help="eps" />
              <Stat label="本益比" value={pe ? pe.toFixed(1) + ' 倍' : '—'} help="pe" />
              {fund?.dividendYield != null && <Stat label="殖利率" value={fund.dividendYield.toFixed(2) + '%'} help="yield" />}
              {fund?.pb != null && <Stat label="股價淨值比" value={fund.pb.toFixed(2)} help="pb" />}
              <Stat label="ROE（近四季）" value={fmtPct(ratios.roe, false, 1)} help="roe" />
              <Stat label="負債比" value={fmtPct(ratios.debtRatio, false, 1)} help="debt" />
              {ratios.currentRatio != null && <Stat label="流動比率" value={ratios.currentRatio.toFixed(2)} help="debt" />}
              <Stat label="自由現金流（近四季）" value={yi(ratios.fcfTtm, cur)} className={cls(ratios.fcfTtm)} help="fcf" />
            </div>
          </div>

          {insights.length > 0 && (
            <div className="card">
              <div className="card-title">財報解讀 <span className="muted small">（依規則自動產生，僅供學習）</span></div>
              <ul className="insights">
                {insights.map((x, i) => (
                  <li key={i} className={x.tone}>{x.text}{x.topic && <Help id={x.topic} />}</li>
                ))}
              </ul>
            </div>
          )}

          <FinCharts fin={fin} />
          <FinTable fin={fin} />
          <p className="muted small pad">資料來源：{fin.source}。財報數字可能因重編而與公司公告略有差異；本頁分析由程式依固定規則產生，不構成投資建議。</p>
        </>
      )}
    </div>
  );
}

function FinCharts({ fin }: { fin: Financials }) {
  const qs = fin.quarters.slice(-12);
  const labels = qs.map((q) => q.key.replace(/^20/, ''));
  const cur = fin.currency;
  const yoy = qs.map((q) => {
    const ly = fin.quarters.find((x) => x.end.slice(5) === q.end.slice(5) && +x.end.slice(0, 4) === +q.end.slice(0, 4) - 1);
    return q.revenue != null && ly?.revenue ? `${((q.revenue / ly.revenue - 1) * 100).toFixed(0)}%` : null;
  });
  const m = qs.map(margins);
  const months = fin.monthly.slice(-24);
  return (
    <>
      <div className="card">
        <div className="card-title">季營收與淨利 <span className="muted small">（{cur === 'USD' ? '美元' : '新台幣'}；下方為營收年增率）</span><Help id="revenue" /></div>
        <BarChart labels={labels} sub={yoy} series={[
          { name: '營收', color: '#4ea1ff', values: qs.map((q) => q.revenue) },
          { name: '淨利', color: '#f5c542', values: qs.map((q) => q.netParent ?? q.net) },
        ]} />
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">獲利率走勢 <Help id="margins" /></div>
          <LinesChart labels={labels} series={[
            ...(fin.financialCo ? [] : [{ name: '毛利率', color: '#4ea1ff', values: m.map((x) => x.gm) }]),
            { name: '營益率', color: '#e46cf0', values: m.map((x) => x.om) },
            { name: '淨利率', color: '#f5c542', values: m.map((x) => x.nm) },
          ]} />
        </div>
        <div className="card">
          <div className="card-title">每季 EPS <Help id="eps" /></div>
          <BarChart labels={labels} format={(v) => v.toFixed(2)} series={[{ name: 'EPS', color: '#22b07d', values: qs.map((q) => q.eps) }]} />
        </div>
      </div>
      {months.length > 0 && (
        <div className="card">
          <div className="card-title">月營收 <span className="muted small">（下方為年增率）</span><Help id="monthrev" /></div>
          <BarChart labels={months.map((x) => x.ym.slice(2).replace('-', '/'))}
            sub={months.map((x) => (x.yoy != null ? `${(x.yoy * 100).toFixed(0)}%` : null))}
            series={[{ name: '月營收', color: '#4ea1ff', values: months.map((x) => x.revenue) }]} />
        </div>
      )}
      <div className="card">
        <div className="card-title">現金流 <Help id="fcf" /></div>
        <BarChart labels={labels} series={[
          { name: '營業現金流', color: '#22b07d', values: qs.map((q) => q.ocf) },
          { name: '資本支出', color: '#f0475a', values: qs.map((q) => (q.capex != null ? -q.capex : undefined)) },
          { name: '自由現金流', color: '#4ea1ff', values: qs.map((q) => q.fcf) },
        ]} />
      </div>
    </>
  );
}

const ROWS: { k: keyof FinPeriod | 'gm' | 'om' | 'nm'; label: string; pct?: boolean; per?: boolean }[] = [
  { k: 'revenue', label: '營收' }, { k: 'gross', label: '營業毛利' }, { k: 'opex', label: '營業費用' },
  { k: 'opIncome', label: '營業利益' }, { k: 'nonOp', label: '業外損益' }, { k: 'preTax', label: '稅前淨利' },
  { k: 'netParent', label: '歸屬母公司淨利' }, { k: 'eps', label: 'EPS', per: true },
  { k: 'gm', label: '毛利率', pct: true }, { k: 'om', label: '營益率', pct: true }, { k: 'nm', label: '淨利率', pct: true },
  { k: 'assets', label: '總資產' }, { k: 'liabilities', label: '總負債' }, { k: 'equityParent', label: '母公司權益' },
  { k: 'cash', label: '現金' }, { k: 'inventory', label: '存貨' }, { k: 'receivable', label: '應收帳款' },
  { k: 'ocf', label: '營業現金流' }, { k: 'capex', label: '資本支出' }, { k: 'fcf', label: '自由現金流' },
];

function FinTable({ fin }: { fin: Financials }) {
  const [mode, setMode] = useState<'q' | 'y'>('q');
  const cols = (mode === 'q' ? fin.quarters.slice(-8) : fin.annual.slice(-5)).slice().reverse();
  const cur = fin.currency;
  const cell = (p: FinPeriod, r: (typeof ROWS)[number]) => {
    if (r.pct) {
      const m = margins(p);
      const v = r.k === 'gm' ? m.gm : r.k === 'om' ? m.om : m.nm;
      return v == null ? '—' : (v * 100).toFixed(1) + '%';
    }
    const v = p[r.k as keyof FinPeriod] as number | undefined;
    if (v == null) return '—';
    if (r.per) return v.toFixed(2);
    return (v / 1e8).toLocaleString('zh-TW', { maximumFractionDigits: Math.abs(v / 1e8) >= 100 ? 0 : 1 });
  };
  const rows = ROWS.filter((r) => cols.some((p) => cell(p, r) !== '—'));
  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>財務報表 <span className="muted small">（單位：{cur === 'USD' ? '億美元' : '億元'}）</span></span>
        <Seg small value={mode} onChange={setMode} options={[{ v: 'q', label: '季' }, { v: 'y', label: '年' }]} />
      </div>
      {cols.length === 0 ? <div className="muted pad">沒有{mode === 'q' ? '季' : '年度'}資料</div> : (
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead><tr><th>項目</th>{cols.map((p) => <th key={p.key}>{p.key}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}><td>{r.label}</td>{cols.map((p) => <td key={p.key}>{cell(p, r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
