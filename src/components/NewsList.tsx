import { useEffect, useState } from 'react';
import { fetchStockNews, googleNews, timeAgo, type NewsItem } from '../lib/news';
import { Seg, Spinner } from './ui';

/** 新聞列表。symbol+name：個股新聞；query：自訂關鍵字（市場頭條） */
export function NewsList({ symbol, name, query, limit = 8, title = '相關新聞' }: {
  symbol?: string; name?: string; query?: string; limit?: number; title?: string;
}) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [err, setErr] = useState('');
  const [lang, setLang] = useState<'all' | 'zh' | 'en'>('all');
  const [more, setMore] = useState(false);
  const key = query || `${symbol}|${name}`;

  const load = () => {
    setErr(''); setItems(null);
    const job = query ? googleNews(query) : fetchStockNews(symbol!, name || symbol!);
    job.then(setItems).catch((e) => setErr(e?.message || String(e)));
  };
  useEffect(() => { setMore(false); load(); }, [key]); // eslint-disable-line

  const hasEn = items?.some((x) => x.lang === 'en');
  const shown = (items || []).filter((x) => lang === 'all' || x.lang === lang);
  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span>{title} <span className="muted small">Google 新聞{hasEn ? '、Yahoo Finance' : ''}</span></span>
        <span className="row gap">
          {hasEn && <Seg small value={lang} onChange={setLang} options={[{ v: 'all', label: '全部' }, { v: 'zh', label: '中文' }, { v: 'en', label: 'EN' }]} />}
          <button className="icon-btn" title="重新整理" onClick={load}>↻</button>
        </span>
      </div>
      {err ? <div className="muted small">無法取得新聞（{err}）。<button className="link" onClick={load}>重試</button></div>
        : !items ? <Spinner />
        : shown.length === 0 ? <div className="muted small">近期沒有找到相關新聞。</div>
        : (
          <div className="news">
            {shown.slice(0, more ? 30 : limit).map((n) => (
              <a key={n.link} className="news-item" href={n.link} target="_blank" rel="noreferrer">
                <div className="news-title">{n.title}</div>
                <div className="muted small">{n.source}{n.time ? ` · ${timeAgo(n.time)}` : ''}</div>
              </a>
            ))}
            {shown.length > limit && <button className="link" onClick={() => setMore(!more)}>{more ? '收起' : `顯示更多（共 ${Math.min(shown.length, 30)} 則）`}</button>}
          </div>
        )}
    </div>
  );
}
