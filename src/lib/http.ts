import { Capacitor, CapacitorHttp } from '@capacitor/core';

declare global {
  interface Window {
    stockBridge?: {
      platform: 'electron';
      get: (url: string, headers?: Record<string, string>) => Promise<{ status: number; body: string; error?: string }>;
      version: () => Promise<string>;
      update: {
        state: () => Promise<any>;
        check: () => Promise<boolean>;
        install: () => Promise<boolean>;
        onStatus: (cb: (s: any) => void) => () => void;
      };
    };
  }
}

export class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}
/** 連不上網路（與「找不到資料」不同） */
export class NetworkError extends Error {}

export type Platform = 'electron' | 'android' | 'web';
export function platform(): Platform {
  if (window.stockBridge) return 'electron';
  if (Capacitor.isNativePlatform()) return 'android';
  return 'web';
}

const PROXY_MAP: [string, string][] = [
  ['https://query1.finance.yahoo.com', '/px/yf1'],
  ['https://query2.finance.yahoo.com', '/px/yf2'],
  ['https://openapi.twse.com.tw', '/px/twse'],
  ['https://www.tpex.org.tw', '/px/tpex'],
  ['https://api.finmindtrade.com', '/px/fm'],
  ['https://zh.wikipedia.org', '/px/wiki'],
];

async function getText(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  const p = platform();
  if (p === 'electron') {
    const r = await window.stockBridge!.get(url, headers);
    if (r.status === 0) throw new NetworkError(r.error || 'network');
    return r;
  }
  if (p === 'android') {
    try {
      const r = await CapacitorHttp.get({
        url,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', ...headers },
        connectTimeout: 15000,
        readTimeout: 20000,
      });
      const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
      return { status: r.status, body };
    } catch (e) {
      throw new NetworkError(String(e));
    }
  }
  // 瀏覽器開發模式：走 vite proxy
  let u = url;
  for (const [from, to] of PROXY_MAP) if (u.startsWith(from)) u = to + u.slice(from.length);
  try {
    const r = await fetch(u, { headers });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    throw new NetworkError(String(e));
  }
}

export async function getJSON<T = any>(url: string, headers?: Record<string, string>): Promise<T> {
  const r = await getText(url, headers);
  let data: any;
  try {
    data = JSON.parse(r.body);
  } catch {
    // vite proxy 在連不上目標時會回 5xx 的 HTML/空字串
    if (r.status >= 500 || r.status === 0) throw new NetworkError(`HTTP ${r.status}`);
    throw new HttpError(r.status, `回應不是 JSON (HTTP ${r.status})`);
  }
  if (r.status >= 400) {
    const err = new HttpError(r.status, data?.chart?.error?.description || `HTTP ${r.status}`);
    (err as any).data = data;
    throw err;
  }
  return data as T;
}
