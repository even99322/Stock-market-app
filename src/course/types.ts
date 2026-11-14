import type { SubKind } from '../components/PriceChart';

export interface Note { d: string; x: string; pos?: 'above' | 'below'; color?: string }
export interface HLine { price: number; title: string; color?: string }

export type Block =
  | { t: 'p'; x: string }
  | { t: 'h'; x: string }
  | { t: 'ul'; items: string[] }
  | { t: 'formula'; x: string }
  | { t: 'tip'; x: string }
  | { t: 'warn'; x: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  /** 日 K 線圖（真實歷史資料）。c：案例代號；from/to：顯示區間 */
  | { t: 'chart'; c: string; from: string; to: string; notes?: Note[]; lines?: HLine[]; ma?: boolean; boll?: boolean; sub?: SubKind; cap?: string }
  /** 5 分 K 線圖。notes 的 d 為 HH:MM */
  | { t: 'intra'; c: string; notes?: Note[]; lines?: HLine[]; cap?: string }
  | { t: 'news'; g: string; only?: number[]; cap?: string }
  | { t: 'chips'; kind: 'inst' | 'margin'; from: string; to: string; cap?: string }
  | { t: 'quiz'; q: string; opts: string[]; a: number; why: string }
  /** 看圖判斷：先只顯示到 upto，選完才揭曉到 to */
  | { t: 'decide'; c: string; from: string; upto: string; to: string; q: string; opts: string[]; best: number; why: string; sub?: SubKind; notes?: Note[]; lines?: HLine[] }
  | { t: 'go'; label: string; to: string };

export interface Lesson { id: string; title: string; mins: number; blocks: Block[] }
export interface Chapter { id: string; title: string; intro: string; lessons: Lesson[] }
