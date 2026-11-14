// 撰寫課程內容用的小工具
import type { SubKind } from '../components/PriceChart';
import type { Block, HLine, Note } from './types';

export const p = (x: string): Block => ({ t: 'p', x });
export const h = (x: string): Block => ({ t: 'h', x });
export const ul = (...items: string[]): Block => ({ t: 'ul', items });
export const f = (x: string): Block => ({ t: 'formula', x });
export const tip = (x: string): Block => ({ t: 'tip', x });
export const warn = (x: string): Block => ({ t: 'warn', x });
export const table = (head: string[], rows: string[][]): Block => ({ t: 'table', head, rows });
export const quiz = (q: string, opts: string[], a: number, why: string): Block => ({ t: 'quiz', q, opts, a, why });
export const news = (g: string, only?: number[], cap?: string): Block => ({ t: 'news', g, only, cap });
export const goto = (label: string, to: string): Block => ({ t: 'go', label, to });
export const chips = (kind: 'inst' | 'margin', from: string, to: string, cap?: string): Block => ({ t: 'chips', kind, from, to, cap });
export const intra = (c: string, o: { notes?: Note[]; lines?: HLine[]; cap?: string } = {}): Block => ({ t: 'intra', c, ...o });
export const chart = (c: string, from: string, to: string, o: { notes?: Note[]; lines?: HLine[]; ma?: boolean; boll?: boolean; sub?: SubKind; cap?: string } = {}): Block =>
  ({ t: 'chart', c, from, to, ...o });
export const decide = (c: string, from: string, upto: string, to: string, q: string, opts: string[], best: number, why: string,
  o: { sub?: SubKind; notes?: Note[]; lines?: HLine[] } = {}): Block => ({ t: 'decide', c, from, upto, to, q, opts, best, why, ...o });
/** 圖上標記：n('2026-01-07', '漲停突破') 預設標在 K 線上方；nb 標在下方 */
export const n = (d: string, x: string, color?: string): Note => ({ d, x, pos: 'above', color });
export const nb = (d: string, x: string, color?: string): Note => ({ d, x, pos: 'below', color });
export const ln = (price: number, title: string, color?: string): HLine => ({ price, title, color });
