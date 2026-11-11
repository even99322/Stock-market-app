import type { Market, Settings, Side } from './types';

/** 台股 ETF（代號 00 開頭）證交稅 0.1%，一般股票 0.3% */
export function isTwEtf(symbol: string) {
  return /^00/.test(symbol.split('.')[0]);
}

export interface FeeResult {
  gross: number; // 成交金額
  fee: number; // 手續費
  tax: number; // 交易稅
  net: number; // 買：需付出的總金額；賣：實際入帳金額
}

/**
 * 台股：手續費 = 成交金額 × 0.1425% × 折數（無條件捨去，最低 twMinFee 元）
 *       證交稅 = 賣出成交金額 × 0.3%（ETF 0.1%）
 * 美股：多數券商零佣金，這裡用每筆固定 usCommission 美元
 */
export function calcFees(market: Market, symbol: string, side: Side, qty: number, price: number, s: Settings): FeeResult {
  const gross = qty * price;
  if (qty <= 0) return { gross: 0, fee: 0, tax: 0, net: 0 };
  if (market === 'TW') {
    const fee = Math.max(Math.floor(gross * 0.001425 * s.twFeeDiscount), s.twMinFee);
    const tax = side === 'sell' ? Math.floor(gross * (isTwEtf(symbol) ? 0.001 : 0.003)) : 0;
    return { gross, fee, tax, net: side === 'buy' ? gross + fee : gross - fee - tax };
  }
  const fee = Math.round(s.usCommission * 100) / 100;
  const g = Math.round(gross * 100) / 100;
  return { gross: g, fee, tax: 0, net: side === 'buy' ? g + fee : g - fee };
}
