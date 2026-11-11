import type { Currency, Market } from './types';

export function fmtPrice(p: number | undefined | null, market?: Market) {
  if (p == null || !Number.isFinite(p)) return '—';
  const d = market === 'US' || Math.abs(p) < 100 ? 2 : Math.abs(p) >= 10000 ? 0 : 2;
  return p.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtMoney(n: number | undefined | null, cur: Currency = 'TWD', sign = false) {
  if (n == null || !Number.isFinite(n)) return '—';
  const d = cur === 'USD' ? 2 : 0;
  const s = Math.abs(n).toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pre = n < 0 ? '-' : sign && n > 0 ? '+' : '';
  return `${pre}${cur === 'USD' ? 'US$' : 'NT$'}${s}`;
}

export function fmtNum(n: number | undefined | null, d = 0) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(x: number | undefined | null, sign = true, d = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${sign && x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;
}

export function fmtVol(v: number, market: Market) {
  if (!Number.isFinite(v)) return '—';
  if (market === 'TW') {
    const lots = v / 1000;
    return lots >= 10000 ? `${(lots / 10000).toFixed(2)} 萬張` : `${fmtNum(lots)} 張`;
  }
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)} 億股`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)} 萬股`;
  return `${fmtNum(v)} 股`;
}

export const cls = (x: number | undefined | null) => (x == null || x === 0 ? 'flat' : x > 0 ? 'up' : 'down');

/** UTC 秒 + 時區偏移 → YYYY-MM-DD（交易所當地日期） */
export function dateStr(t: number, gmtoffset: number) {
  return new Date((t + gmtoffset) * 1000).toISOString().slice(0, 10);
}

export function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
