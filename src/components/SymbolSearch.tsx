import { useEffect, useRef, useState } from 'react';
import { localSearch, normalizeSymbol, remoteSearch, type SymbolInfo } from '../lib/names';

/** 代號 / 名稱搜尋框：本機清單即時比對，美股再補線上搜尋 */
export function SymbolSearch({ onPick, placeholder, autoFocus, excludeIndex }: {
  onPick: (s: SymbolInfo) => void; placeholder?: string; autoFocus?: boolean; excludeIndex?: boolean;
}) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SymbolInfo[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<any>();

  useEffect(() => {
    const local = localSearch(q).filter((x) => !excludeIndex || x.kind !== 'index');
    setRes(local);
    clearTimeout(timer.current);
    if (q.trim().length >= 1 && /[A-Za-z]/.test(q)) {
      timer.current = setTimeout(async () => {
        try {
          const remote = (await remoteSearch(q)).filter((x) => !excludeIndex || x.kind !== 'index');
          setRes((cur) => {
            const seen = new Set(cur.map((x) => x.symbol));
            return [...cur, ...remote.filter((x) => !seen.has(x.symbol))].slice(0, 15);
          });
        } catch { /* 離線 */ }
      }, 400);
    }
  }, [q, excludeIndex]);

  const pick = (s: SymbolInfo) => { onPick(s); setQ(''); setOpen(false); };
  const submit = () => {
    if (res[0]) return pick(res[0]);
    const sym = normalizeSymbol(q);
    if (sym) pick({ symbol: sym, name: sym, market: /\.(TW|TWO)$/.test(sym) ? 'TW' : 'US' });
  };

  return (
    <div className="search">
      <input
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder || '搜尋代號或名稱：2330、台積電、AAPL…'}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {open && q && (
        <div className="search-results">
          {res.length === 0 && <div className="muted pad">按 Enter 直接查詢「{normalizeSymbol(q)}」</div>}
          {res.map((s) => (
            <button key={s.symbol} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
              <span className={`tag ${s.market}`}>{s.market === 'TW' ? '台' : '美'}</span>
              <b>{s.symbol.replace(/\.(TW|TWO)$/, '')}</b>
              <span className="muted">{s.name}</span>
              {s.kind === 'etf' && <span className="tag">ETF</span>}
              {s.kind === 'index' && <span className="tag">指數</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
