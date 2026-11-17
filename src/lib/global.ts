// 全球市場總覽：匯率、利率、期貨、商品、各國指數
import type { InstKind } from './types';

export interface GItem { s: string; name: string; why: string }
export interface GGroup { id: string; title: string; note?: string; items: GItem[] }
const it = (s: string, name: string, why: string): GItem => ({ s, name, why });

export const GLOBAL_GROUPS: GGroup[] = [
  { id: 'twfut', title: '台灣期貨', note: '期交所每日行情，收盤後更新，只有日 K', items: [
    it('TX.TAIFEX', '台指期 日盤', '加權指數的期貨（近月）。常領先現貨反應'),
    it('TXN.TAIFEX', '台指期 夜盤', '15:00～隔日 05:00，反映夜間國際股市'),
    it('^TWII', '加權指數', '期貨對應的現貨，兩者的差距叫「正逆價差」'),
  ] },
  { id: 'fx', title: '匯率', note: '「A/B」是 1 單位 A 可換多少 B', items: [
    it('TWD=X', '美元/台幣', '數字下降＝台幣升值，通常伴隨外資匯入買股'),
    it('JPYTWD=X', '日圓/台幣', '1 日圓換多少台幣；旅遊換匯常看'),
    it('EURTWD=X', '歐元/台幣', '1 歐元換多少台幣'),
    it('HKDTWD=X', '港幣/台幣', '1 港幣換多少台幣'),
    it('DX-Y.NYB', '美元指數', '美元對六種主要貨幣的強弱'),
    it('JPY=X', '美元/日圓', '日圓走勢；日圓急升常伴隨全球股市震盪'),
    it('EURUSD=X', '歐元/美元', '全球交易量最大的貨幣對'),
    it('CNY=X', '美元/人民幣', '人民幣走勢，亞洲貨幣多半同向'),
    it('KRW=X', '美元/韓元', '韓元與台幣同為出口導向貨幣，常一起動'),
  ] },
  { id: 'rate', title: '美國公債殖利率', note: '單位為 %。殖利率上升＝債券價格下跌', items: [
    it('^IRX', '3個月期', '最貼近聯準會政策利率'),
    it('^FVX', '5年期', '中期利率預期'),
    it('^TNX', '10年期', '全球資產定價的基準；上升會壓抑成長股'),
    it('^TYX', '30年期', '長期利率與通膨預期'),
  ] },
  { id: 'idxfut', title: '股價指數期貨', note: '幾乎 24 小時交易，可看出美股開盤前的方向', items: [
    it('ES=F', 'S&P 500 期貨', '美股大盤期貨'),
    it('NQ=F', '那斯達克100 期貨', '科技股期貨，和台股電子股最相關'),
    it('YM=F', '道瓊期貨', '傳產藍籌股期貨'),
    it('RTY=F', '羅素2000 期貨', '美國小型股期貨'),
    it('NKD=F', '日經225 期貨', '日股期貨（美元計價）'),
  ] },
  { id: 'cmd', title: '商品期貨', note: '近月合約，美元計價', items: [
    it('GC=F', '黃金', '避險資產；利率下降、局勢緊張時走強'),
    it('SI=F', '白銀', '兼具貴金屬與工業用途，波動比黃金大'),
    it('HG=F', '銅', '景氣指標；也影響電線電纜、銅箔基板成本'),
    it('CL=F', '西德州原油', '美國原油基準；影響塑化、航運、航空'),
    it('BZ=F', '布蘭特原油', '國際原油基準'),
    it('NG=F', '天然氣', '發電與化工原料；季節性波動大'),
    it('ZC=F', '玉米', '飼料與食品原料（美分/英斗）'),
    it('ZS=F', '黃豆', '食用油與飼料原料（美分/英斗）'),
  ] },
  { id: 'idx', title: '全球指數', items: [
    it('^GSPC', 'S&P 500', '美股大盤'),
    it('^IXIC', '那斯達克', '美國科技股'),
    it('^DJI', '道瓊工業', '美國 30 檔藍籌股'),
    it('^SOX', '費城半導體', '台灣電子股的風向球'),
    it('^VIX', 'VIX 恐慌指數', '市場預期波動；急升通常伴隨股市下跌'),
    it('^N225', '日經225', '日本股市'),
    it('^KS11', '韓國 KOSPI', '韓國股市，和台股同受半導體影響'),
    it('^HSI', '恆生指數', '香港股市'),
    it('000001.SS', '上證指數', '中國股市'),
    it('^GDAXI', '德國 DAX', '歐洲最大經濟體'),
    it('^FTSE', '英國富時100', '英國股市'),
  ] },
  { id: 'crypto', title: '加密貨幣', note: '24 小時交易，可觀察市場風險偏好', items: [
    it('BTC-USD', '比特幣', '市值最大的加密貨幣'),
    it('ETH-USD', '以太幣', '市值第二大'),
  ] },
];

/** 首頁「全球市場」摘要顯示的標的 */
export const GLOBAL_PICKS = ['TX.TAIFEX', 'TWD=X', 'NQ=F', 'GC=F', 'CL=F', '^TNX'];
export const globalItem = (s: string) => GLOBAL_GROUPS.flatMap((g) => g.items).find((i) => i.s === s);

/** 個股頁：非股票標的的說明文字 */
export function kindNote(kind: InstKind | undefined, symbol: string): { title: string; lines: string[] } {
  const why = globalItem(symbol)?.why;
  const base = why ? [why + '。'] : [];
  switch (kind) {
    case 'fx': return { title: '這是匯率', lines: [...base,
      '報價是「前面的貨幣 1 單位可換多少後面的貨幣」。例如美元/台幣上升代表美元變貴、台幣貶值。',
      '外匯市場週一到週五 24 小時交易，沒有集中交易所，所以沒有成交量；圖表時間為台灣時間。',
      '模擬帳戶的換匯請到「帳戶」頁；這裡的走勢可以用來觀察外資動向與換匯時機。'] };
    case 'rate': return { title: '這是殖利率', lines: [...base,
      '數值的單位是 %（例如 4.25 代表年利率 4.25%），不是價格。',
      '殖利率上升代表債券價格下跌、資金成本變高，通常不利高本益比的成長股。'] };
    case 'future': return symbol.endsWith('.TAIFEX')
      ? { title: '這是台指期', lines: [...base,
        '走勢為「近月連續」日 K：每天取成交量最大的月份合約，結算日（每月第三個週三）前後會換到下個月，可能出現小幅跳動。',
        '資料來自期交所每日行情，收盤後才更新，沒有盤中即時走勢。成交量單位是「口」。',
        '期貨有槓桿與保證金追繳風險，模擬帳戶不提供期貨交易；想跟著大盤可以買 0050。'] }
      : { title: '這是期貨', lines: [...base,
        '報價為近月合約，合約到期換月時走勢可能出現跳空。成交量單位是「口」。',
        '期貨幾乎 24 小時交易，台灣白天看到的是美國的夜盤（電子盤），量較小。',
        '期貨有槓桿，模擬帳戶不提供期貨交易；可以改用對應的 ETF 練習（例如黃金 GLD、原油 USO、那斯達克 QQQ）。'] };
    case 'crypto': return { title: '這是加密貨幣', lines: [...base,
      '24 小時、全年無休交易，波動遠大於股票。圖表時間為台灣時間。', '模擬帳戶不提供加密貨幣交易。'] };
    default: return { title: '這是指數', lines: [...base,
      '指數無法直接交易。想買整個市場可以搜尋 0050（台灣 50）或 SPY / VOO（S&P 500 ETF）。'] };
  }
}
