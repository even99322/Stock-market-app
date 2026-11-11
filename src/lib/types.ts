export type Market = 'TW' | 'US';
export type Currency = 'TWD' | 'USD';
export type Side = 'buy' | 'sell';

/** 一根 K 線。time 為 UTC unix 秒 */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartData {
  symbol: string;
  name: string;
  market: Market;
  currency: Currency;
  bars: Bar[];
  price: number;
  prevClose: number;
  /** 交易所時區相對 UTC 的秒數，例如台灣 28800 */
  gmtoffset: number;
  isOpen: boolean;
  intraday: boolean;
  demo: boolean;
  tradable: boolean;
  fetchedAt: number;
  high52?: number;
  low52?: number;
  exchangeName?: string;
}

export interface Trade {
  id: string;
  time: number; // ms
  symbol: string;
  name: string;
  market: Market;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  tax: number;
  /** 現金變動（買為負、賣為正） */
  amount: number;
  /** 賣出時的已實現損益 */
  realized?: number;
  note?: string;
}

export interface Position {
  symbol: string;
  name: string;
  market: Market;
  currency: Currency;
  qty: number;
  /** 平均成本（含買進手續費） */
  avgCost: number;
}

export interface PendingOrder {
  id: string;
  createdAt: number; // ms
  symbol: string;
  name: string;
  market: Market;
  side: Side;
  qty: number;
  limit: number;
}

export interface FxRecord {
  id: string;
  time: number;
  from: Currency;
  to: Currency;
  fromAmount: number;
  toAmount: number;
  rate: number;
}

export interface Account {
  cash: Record<Currency, number>;
  initial: Record<Currency, number>;
  positions: Record<string, Position>;
  orders: PendingOrder[];
  trades: Trade[];
  fx: FxRecord[];
  realized: Record<Currency, number>;
  /** 每日資產快照（換算台幣） */
  equityLog: { d: string; v: number }[];
  createdAt: number;
}

export interface ReplaySession {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  currency: Currency;
  startDate: string; // YYYY-MM-DD
  curDate: string;
  initialCash: number;
  cash: number;
  qty: number;
  avgCost: number;
  realized: number;
  trades: Trade[];
  equity: { d: string; v: number }[];
  blind: boolean;
  finished: boolean;
  createdAt: number;
}

export interface Settings {
  /** 台股手續費折數，1 = 不打折，0.6 = 六折 */
  twFeeDiscount: number;
  twMinFee: number;
  usCommission: number;
  /** true = 台灣慣例紅漲綠跌 */
  redUp: boolean;
  initialTWD: number;
  initialUSD: number;
  refreshSec: number;
  firebaseConfig: string;
  /** FinMind API token（選填，可提高查詢上限） */
  finmindToken?: string;
}

export interface AppState {
  version: 1;
  account: Account;
  replays: ReplaySession[];
  watchlist: string[];
  settings: Settings;
  updatedAt: number;
}
