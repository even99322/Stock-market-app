// 新聞：Google 新聞 RSS（彙整各大財經媒體的標題與連結）＋ Yahoo Finance（美股英文新聞）
import { getJSON, getText } from './http';
import { BUILTIN } from './names';
import { THEMES } from './themes';

export interface NewsItem { title: string; source: string; link: string; time: number; lang: 'zh' | 'en' }

const JUNK = /實時行情|即時行情|Stock Price, News, Quote|股價走勢圖|股市爆料同學會/;

/** 解析 Google 新聞 RSS（標題尾端的「 - 媒體名」會移到 source） */
export function parseGoogleNews(xml: string, lang: 'zh' | 'en' = 'zh'): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const out: NewsItem[] = [];
  const seen = new Set<string>();
  doc.querySelectorAll('item').forEach((it) => {
    const rawTitle = it.querySelector('title')?.textContent?.trim() || '';
    const source = it.querySelector('source')?.textContent?.trim() || '';
    const link = it.querySelector('link')?.textContent?.trim() || '';
    const time = Date.parse(it.querySelector('pubDate')?.textContent || '') || 0;
    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    else title = title.replace(/\s+-\s+[^-]{1,30}$/, '');
    const key = title.replace(/\s/g, '').slice(0, 24);
    if (!title || !/^https?:\/\//.test(link) || JUNK.test(rawTitle) || seen.has(key)) return;
    seen.add(key);
    out.push({ title, source, link, time, lang });
  });
  return out.sort((a, b) => b.time - a.time);
}

export function parseYahooNews(d: any): NewsItem[] {
  return (d?.news || [])
    .filter((n: any) => n?.title && /^https?:\/\//.test(n.link || ''))
    .map((n: any) => ({ title: n.title, source: n.publisher || 'Yahoo Finance', link: n.link, time: (n.providerPublishTime || 0) * 1000, lang: 'en' as const }));
}

const cache = new Map<string, { at: number; items: NewsItem[] }>();
async function cached(key: string, fn: () => Promise<NewsItem[]>): Promise<NewsItem[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.items;
  const items = await fn();
  cache.set(key, { at: Date.now(), items });
  return items;
}

export function googleNews(query: string, lang: 'zh' | 'en' = 'zh'): Promise<NewsItem[]> {
  const loc = lang === 'zh' ? 'hl=zh-TW&gl=TW&ceid=TW:zh-Hant' : 'hl=en-US&gl=US&ceid=US:en';
  return cached(`g|${lang}|${query}`, async () => {
    const r = await getText(`https://news.google.com/rss/search?${loc}&q=${encodeURIComponent(query)}`);
    if (r.status !== 200) throw new Error(`新聞來源回應 ${r.status}`);
    return parseGoogleNews(r.body, lang);
  });
}

function yahooNews(symbol: string): Promise<NewsItem[]> {
  return cached(`y|${symbol}`, async () =>
    parseYahooNews(await getJSON(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=10&listsCount=0`)));
}

/** 中文搜尋關鍵字：台股「名稱 代號」，美股「中文名 代號」 */
export function newsQuery(symbol: string, name: string): string {
  const tw = /\.(TW|TWO)$/.test(symbol);
  const code = symbol.replace(/\.(TW|TWO)$/, '');
  if (tw) return `${name.replace(/-KY$|\*$/, '')} ${code} when:14d`;
  if (symbol === '^TWII') return '台股 大盤 when:3d';
  const zh = THEMES.flatMap((t) => t.us).find((m) => m.code === symbol)?.name
    || BUILTIN.find((b) => b.symbol === symbol)?.name.replace(/[A-Za-z&.()\-]+/g, ' ').replace(/\d+/g, ' ').trim();
  if (/[\^=]|\.NYB$/.test(symbol)) return `${zh || name} when:7d`;
  return `${zh || name.split(/[\s,]/)[0]} ${symbol} when:14d`;
}

/** 個股新聞：中文（Google 新聞）＋美股另加英文（Yahoo Finance） */
export async function fetchStockNews(symbol: string, name: string): Promise<NewsItem[]> {
  const tw = /\.(TW|TWO)$/.test(symbol);
  const jobs: Promise<NewsItem[]>[] = [googleNews(newsQuery(symbol, name))];
  if (!tw) jobs.push(yahooNews(symbol));
  const res = await Promise.allSettled(jobs);
  const ok = res.filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled');
  if (!ok.length) throw (res[0] as PromiseRejectedResult).reason;
  return ok.flatMap((r) => r.value).sort((a, b) => b.time - a.time);
}

export function timeAgo(ms: number): string {
  if (!ms) return '';
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} 小時前`;
  if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)} 天前`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
