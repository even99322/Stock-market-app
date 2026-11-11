// 中文維基百科公司簡介（搜尋第一筆，轉繁體）
import { getJSON } from './http';

export interface WikiSummary { title: string; extract: string; url: string }
const cache = new Map<string, WikiSummary | null>();

/** mustMatch：結果的標題或內文必須包含其中一個字串（避免搜到別家公司） */
export async function fetchWiki(query: string, mustMatch: string[] = []): Promise<WikiSummary | null> {
  if (cache.has(query)) return cache.get(query)!;
  const url = 'https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=extracts|info&inprop=url'
    + '&exintro=1&explaintext=1&redirects=1&variant=zh-tw&format=json&origin=*&gsrsearch=' + encodeURIComponent(query);
  try {
    const d = await getJSON<any>(url, { 'Api-User-Agent': 'StockSim/1.0 (github.com/even99322/Stock-market-app)' });
    const page: any = Object.values(d?.query?.pages || {})[0];
    const text = `${page?.title || ''} ${page?.extract || ''}`.toLowerCase();
    const ok = !mustMatch.length || mustMatch.some((k) => k && text.includes(k.toLowerCase()));
    const res = page?.extract && ok ? { title: page.title, extract: String(page.extract).trim().slice(0, 900), url: page.fullurl || `https://zh.wikipedia.org/wiki/${encodeURIComponent(page.title)}` } : null;
    cache.set(query, res);
    return res;
  } catch {
    return null;
  }
}
