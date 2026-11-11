// 個股的「相關市場」：大盤、匯率、期貨、ETF（依市場與題材決定）
import { isIndex } from './names';
import { themesOf, usSectorOf } from './themes';

export interface RelItem { s: string; name: string; why: string }
export interface RelGroup { title: '大盤指數' | '匯率・利率' | '期貨' | 'ETF・ADR'; items: RelItem[]; taifex?: boolean }

const it = (s: string, name: string, why: string): RelItem => ({ s, name, why });
const SEMI_THEMES = new Set(['ai-server', 'foundry', 'packaging', 'ic-design', 'memory', 'semi-equip', 'cooling', 'network']);
const ADR: Record<string, RelItem> = {
  '2330.TW': it('TSM', '台積電 ADR', '美股夜間的台積電價格，常影響隔天開盤'),
  '2303.TW': it('UMC', '聯電 ADR', '美股掛牌的聯電'),
  '3711.TW': it('ASX', '日月光 ADR', '美股掛牌的日月光'),
  '2412.TW': it('CHT', '中華電 ADR', '美股掛牌的中華電'),
};
const TW_FROM_ADR: Record<string, RelItem> = {
  TSM: it('2330.TW', '台積電', '台股掛牌的本尊（1 ADR = 5 股）'),
  UMC: it('2303.TW', '聯電', '台股掛牌的本尊'),
  ASX: it('3711.TW', '日月光投控', '台股掛牌的本尊'),
};

export function relatedMarkets(symbol: string, industry?: string): RelGroup[] {
  const tw = /\.(TW|TWO)$/.test(symbol) || symbol === '^TWII';
  const themes = themesOf(symbol).map((t) => t.id);
  const semi = themes.some((t) => SEMI_THEMES.has(t)) || /半導體|電子|電腦|光電|通信/.test(industry || '');
  const fin = themes.includes('finance') || /金融/.test(industry || '');
  const oil = themes.includes('shipping') || /塑膠|航運|油電|化學/.test(industry || '');
  const sec = usSectorOf(symbol);
  const groups: RelGroup[] = [];
  const uniq = (a: RelItem[]) => a.filter((x, i) => x.s !== symbol && a.findIndex((y) => y.s === x.s) === i);

  if (tw) {
    groups.push({ title: '大盤指數', items: uniq([
      it('^TWII', '加權指數', '台股大盤，個股多半跟著大盤方向'),
      ...(semi ? [it('^SOX', '費城半導體', '美國半導體股指數，台灣電子股的風向球')] : []),
      it('^IXIC', '那斯達克', '美國科技股，隔夜漲跌影響台股開盤'),
      ...(semi ? [] : [it('^GSPC', 'S&P 500', '美股大盤')]),
    ]) });
    groups.push({ title: '匯率・利率', items: uniq([
      it('TWD=X', '美元/台幣', '數字下降＝台幣升值，通常代表外資匯入'),
      it('DX-Y.NYB', '美元指數', '美元強弱；強勢美元常壓抑新興市場股市'),
      ...(fin ? [it('^TNX', '美10年債殖利率', '利率走向影響金融股利差與債券部位')] : []),
    ]) });
    groups.push({ title: '期貨', taifex: true, items: uniq([
      it('NQ=F', '那斯達克期貨', '幾乎全天交易，可看出美股開盤前的氣氛'),
      ...(oil ? [it('CL=F', '原油期貨', '油價影響塑化成本與航運燃料')] : []),
    ]) });
    groups.push({ title: 'ETF・ADR', items: uniq([
      ...(ADR[symbol] ? [ADR[symbol]] : []),
      it('0050.TW', '元大台灣50', '台灣前 50 大公司，代表大型股整體'),
      it('EWT', 'MSCI 台灣 ETF', '美股掛牌的台股 ETF，反映外資夜間對台股的看法'),
      ...(semi ? [it('SOXX', '半導體 ETF', '美國半導體類股 ETF')] : []),
    ]) });
  } else {
    groups.push({ title: '大盤指數', items: uniq([
      it('^GSPC', 'S&P 500', '美股大盤'),
      it('^IXIC', '那斯達克', '科技股為主的指數'),
      ...(semi ? [it('^SOX', '費城半導體', '半導體類股指數')] : []),
      it('^VIX', 'VIX 恐慌指數', '市場預期波動；急升通常伴隨股市下跌'),
    ]) });
    groups.push({ title: '匯率・利率', items: uniq([
      it('^TNX', '美10年債殖利率', '利率上升會壓抑成長股估值'),
      it('DX-Y.NYB', '美元指數', '美元強弱影響跨國企業海外營收'),
      it('TWD=X', '美元/台幣', '台灣投資人買美股的換匯成本'),
    ]) });
    groups.push({ title: '期貨', items: uniq([
      it('ES=F', 'S&P 500 期貨', '盤前盤後的大盤方向'),
      it('NQ=F', '那斯達克期貨', '盤前盤後的科技股方向'),
      ...(sec?.etf === 'XLE' ? [it('CL=F', '原油期貨', '能源股獲利的關鍵')] : []),
      ...(sec?.etf === 'XLB' ? [it('GC=F', '黃金期貨', '礦業股連動')] : []),
    ]) });
    groups.push({ title: 'ETF・ADR', items: uniq([
      ...(TW_FROM_ADR[symbol] ? [TW_FROM_ADR[symbol]] : []),
      ...(sec && !isIndex(symbol) ? [it(sec.etf, `${sec.name}類股 ETF`, '這檔股票所屬的類股')] : []),
      ...(semi ? [it('SOXX', '半導體 ETF', '半導體類股 ETF')] : []),
      it('SPY', 'S&P 500 ETF', '大盤 ETF'),
      it('QQQ', '那斯達克100 ETF', '大型科技股 ETF'),
    ]) });
  }
  return groups.filter((g) => g.items.length > 0 || g.taifex);
}
