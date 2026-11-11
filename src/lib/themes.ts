// 熱門題材（概念股）與美股 11 大類股。台股只存代號，執行時再對應 .TW / .TWO。
export interface ThemeMember { code: string; name: string; role?: string }
export interface Theme {
  id: string;
  name: string;
  desc: string;
  tw: ThemeMember[];
  us: ThemeMember[];
}

const m = (code: string, name: string, role?: string): ThemeMember => ({ code, name, role });

export const THEMES: Theme[] = [
  {
    id: 'ai-server', name: 'AI 伺服器',
    desc: '雲端業者大量採購 GPU 伺服器。台廠負責伺服器組裝、機櫃整合、電源與散熱，美國端是 GPU 與品牌伺服器廠。',
    tw: [m('2317', '鴻海', '組裝/機櫃'), m('2382', '廣達', '組裝/機櫃'), m('3231', '緯創', '主機板/組裝'), m('6669', '緯穎', '雲端伺服器'), m('2356', '英業達', '組裝'), m('2376', '技嘉', '伺服器/板卡'), m('3706', '神達', '伺服器'), m('2308', '台達電', '電源')],
    us: [m('NVDA', '輝達', 'GPU'), m('AMD', '超微', 'GPU/CPU'), m('SMCI', '美超微', '伺服器'), m('DELL', '戴爾', '伺服器')],
  },
  {
    id: 'foundry', name: '晶圓代工',
    desc: '替 IC 設計公司製造晶片。先進製程（3/2 奈米）由台積電領先，成熟製程競爭者較多、價格較受景氣影響。',
    tw: [m('2330', '台積電', '先進製程'), m('2303', '聯電', '成熟製程'), m('5347', '世界', '成熟製程'), m('6770', '力積電', '成熟/記憶體代工')],
    us: [m('TSM', '台積電 ADR'), m('INTC', '英特爾', 'IDM/代工'), m('GFS', '格羅方德', '成熟製程')],
  },
  {
    id: 'packaging', name: '先進封裝・封測',
    desc: 'AI 晶片需要 CoWoS 等先進封裝把 GPU 與高頻寬記憶體封在一起；封測廠負責封裝與測試，設備廠供應相關機台。',
    tw: [m('3711', '日月光投控', '封測龍頭'), m('2449', '京元電子', '測試'), m('6239', '力成', '記憶體封測'), m('3131', '弘塑', '濕製程設備'), m('6187', '萬潤', '封裝設備'), m('3583', '辛耘', '設備')],
    us: [m('AMKR', 'Amkor', '封測')],
  },
  {
    id: 'ic-design', name: 'IC 設計',
    desc: '只設計晶片、交給晶圓廠代工（Fabless）。毛利率高，景氣與產品週期影響大。',
    tw: [m('2454', '聯發科', '手機/AI ASIC'), m('3034', '聯詠', '驅動 IC'), m('2379', '瑞昱', '網通/PC'), m('3661', '世芯-KY', 'ASIC'), m('3443', '創意', 'ASIC'), m('5269', '祥碩', '高速傳輸'), m('4966', '譜瑞-KY', '高速傳輸')],
    us: [m('NVDA', '輝達'), m('AMD', '超微'), m('AVGO', '博通'), m('QCOM', '高通'), m('ARM', 'Arm')],
  },
  {
    id: 'cooling', name: '散熱',
    desc: 'AI 晶片功耗大增，散熱從氣冷走向水冷（液冷），散熱模組與零組件需求成長。',
    tw: [m('3017', '奇鋐', '散熱模組'), m('3324', '雙鴻', '散熱模組'), m('3653', '健策', '均熱片'), m('2421', '建準', '風扇')],
    us: [],
  },
  {
    id: 'apple', name: '蘋果供應鏈',
    desc: 'iPhone、Mac 等產品的組裝與零組件供應商，營運跟著蘋果新品週期與銷量走。',
    tw: [m('2317', '鴻海', 'iPhone 組裝'), m('4938', '和碩', '組裝'), m('3008', '大立光', '鏡頭'), m('3406', '玉晶光', '鏡頭'), m('2474', '可成', '機殼'), m('2354', '鴻準', '機構件')],
    us: [m('AAPL', '蘋果')],
  },
  {
    id: 'memory', name: '記憶體',
    desc: 'DRAM 與 NAND Flash 價格週期性很強；AI 帶動高頻寬記憶體（HBM）需求。',
    tw: [m('2408', '南亞科', 'DRAM'), m('2344', '華邦電', '利基型記憶體'), m('2337', '旺宏', 'NOR/NAND'), m('8299', '群聯', 'NAND 控制晶片'), m('3260', '威剛', '記憶體模組')],
    us: [m('MU', '美光')],
  },
  {
    id: 'network', name: '網通・光通訊',
    desc: '資料中心高速交換器與光通訊（含矽光子、CPO）需求隨 AI 叢集擴大而成長。',
    tw: [m('2345', '智邦', '資料中心交換器'), m('4979', '華星光', '光通訊模組'), m('3081', '聯亞', '雷射磊晶'), m('3363', '上詮', '光纖元件'), m('6442', '光聖', '光纖元件')],
    us: [m('ANET', 'Arista', '交換器'), m('CSCO', '思科', '網通設備')],
  },
  {
    id: 'semi-equip', name: '半導體設備・材料',
    desc: '晶圓廠擴產時採購設備與材料：矽晶圓、光罩盒、廠務工程、研磨耗材等。',
    tw: [m('6488', '環球晶', '矽晶圓'), m('5483', '中美晶', '矽晶圓'), m('3680', '家登', '光罩盒/載具'), m('2404', '漢唐', '無塵室工程'), m('6196', '帆宣', '廠務/設備'), m('1560', '中砂', '鑽石碟')],
    us: [m('ASML', 'ASML', '曝光機'), m('AMAT', '應用材料'), m('LRCX', '科林研發'), m('KLAC', '科磊', '量測檢測')],
  },
  {
    id: 'power', name: '重電・電力',
    desc: '電網更新、綠能併網與資料中心用電，帶動變壓器、配電盤、電纜需求。',
    tw: [m('1519', '華城', '變壓器'), m('1503', '士電', '重電'), m('1513', '中興電', '重電'), m('1514', '亞力', '配電設備'), m('1609', '大亞', '電線電纜')],
    us: [m('GEV', 'GE Vernova', '電網/發電設備'), m('ETN', 'Eaton', '電力管理')],
  },
  {
    id: 'shipping', name: '航運',
    desc: '貨櫃航運運價波動極大，獲利高度循環；航空業受油價與旅遊需求影響。',
    tw: [m('2603', '長榮', '貨櫃'), m('2609', '陽明', '貨櫃'), m('2615', '萬海', '貨櫃'), m('2618', '長榮航', '航空'), m('2610', '華航', '航空')],
    us: [],
  },
  {
    id: 'finance', name: '金融',
    desc: '金控（銀行、壽險、證券）。獲利受利率、股債市表現影響，是存股族常見標的。',
    tw: [m('2881', '富邦金'), m('2882', '國泰金'), m('2891', '中信金'), m('2886', '兆豐金'), m('2884', '玉山金'), m('2885', '元大金'), m('2892', '第一金'), m('5880', '合庫金')],
    us: [m('JPM', '摩根大通'), m('BAC', '美國銀行'), m('V', 'Visa'), m('MA', 'Mastercard')],
  },
  {
    id: 'ev', name: '電動車',
    desc: '電動車與相關零組件：電源系統、線束、傳動零件與整車。',
    tw: [m('2308', '台達電', '電源/動力系統'), m('3665', '貿聯-KY', '線束'), m('1536', '和大', '傳動齒輪'), m('2207', '和泰車', '汽車代理'), m('2201', '裕隆', '整車')],
    us: [m('TSLA', '特斯拉')],
  },
  {
    id: 'robot', name: '機器人・自動化',
    desc: '工業自動化、AI 視覺與人形機器人，需要精密傳動元件與控制系統。',
    tw: [m('2359', '所羅門', 'AI 視覺'), m('2049', '上銀', '線性滑軌'), m('1590', '亞德客-KY', '氣動元件'), m('4583', '台灣精銳', '減速機')],
    us: [m('TSLA', '特斯拉', '人形機器人'), m('ISRG', '直覺外科', '手術機器人')],
  },
  {
    id: 'biotech', name: '生技醫療',
    desc: '新藥開發風險高、時間長；學名藥與醫材相對穩定。減重藥（GLP-1）是近年熱門題材。',
    tw: [m('6446', '藥華藥', '新藥'), m('1795', '美時', '學名藥'), m('6472', '保瑞', 'CDMO'), m('4743', '合一', '新藥')],
    us: [m('LLY', '禮來'), m('NVO', '諾和諾德')],
  },
  {
    id: 'high-div', name: '高股息 ETF',
    desc: '挑選高殖利率股票組成的 ETF，月配或季配息，是台灣最熱門的 ETF 類型；注意配息可能來自收益平準金。',
    tw: [m('0056', '元大高股息'), m('00878', '國泰永續高股息'), m('00919', '群益台灣精選高息'), m('00929', '復華台灣科技優息'), m('00713', '元大台灣高息低波')],
    us: [m('SCHD', 'Schwab 美國高股息'), m('VYM', 'Vanguard 高股息')],
  },
  {
    id: 'mega-tech', name: '美國七巨頭',
    desc: '市值最大的美國科技股，佔 S&P 500 權重很高，左右美股大盤走勢。',
    tw: [],
    us: [m('AAPL', '蘋果'), m('MSFT', '微軟'), m('NVDA', '輝達'), m('GOOGL', 'Alphabet'), m('AMZN', '亞馬遜'), m('META', 'Meta'), m('TSLA', '特斯拉')],
  },
];

export interface UsSector { etf: string; name: string; desc: string; holdings: ThemeMember[] }
export const US_SECTORS: UsSector[] = [
  { etf: 'XLK', name: '資訊科技', desc: '半導體、軟體、硬體', holdings: [m('NVDA', '輝達'), m('AAPL', '蘋果'), m('MSFT', '微軟'), m('AVGO', '博通'), m('ORCL', '甲骨文'), m('AMD', '超微'), m('CSCO', '思科')] },
  { etf: 'XLF', name: '金融', desc: '銀行、支付、保險', holdings: [m('BRK-B', '波克夏'), m('JPM', '摩根大通'), m('V', 'Visa'), m('MA', 'Mastercard'), m('BAC', '美國銀行'), m('WFC', '富國銀行'), m('GS', '高盛')] },
  { etf: 'XLV', name: '醫療保健', desc: '製藥、醫材、保險', holdings: [m('LLY', '禮來'), m('JNJ', '嬌生'), m('ABBV', '艾伯維'), m('UNH', '聯合健康'), m('MRK', '默克'), m('ABT', '亞培'), m('ISRG', '直覺外科')] },
  { etf: 'XLY', name: '非必需消費', desc: '電商、汽車、餐飲零售', holdings: [m('AMZN', '亞馬遜'), m('TSLA', '特斯拉'), m('HD', '家得寶'), m('MCD', '麥當勞'), m('BKNG', 'Booking'), m('TJX', 'TJX'), m('LOW', '勞氏')] },
  { etf: 'XLC', name: '通訊服務', desc: '網路平台、媒體、電信', holdings: [m('META', 'Meta'), m('GOOGL', 'Alphabet'), m('NFLX', 'Netflix'), m('DIS', '迪士尼'), m('TMUS', 'T-Mobile'), m('VZ', 'Verizon'), m('T', 'AT&T')] },
  { etf: 'XLI', name: '工業', desc: '航太國防、機械、運輸', holdings: [m('GE', '奇異航太'), m('CAT', '開拓重工'), m('RTX', 'RTX'), m('UBER', 'Uber'), m('HON', '漢威聯合'), m('UNP', '聯合太平洋'), m('BA', '波音')] },
  { etf: 'XLP', name: '必需消費', desc: '食品飲料、量販、日用品', holdings: [m('WMT', '沃爾瑪'), m('COST', '好市多'), m('PG', '寶僑'), m('KO', '可口可樂'), m('PEP', '百事'), m('PM', '菲利普莫里斯')] },
  { etf: 'XLE', name: '能源', desc: '石油天然氣', holdings: [m('XOM', '埃克森美孚'), m('CVX', '雪佛龍'), m('COP', '康菲'), m('EOG', 'EOG'), m('SLB', 'SLB')] },
  { etf: 'XLU', name: '公用事業', desc: '電力、天然氣供應', holdings: [m('NEE', 'NextEra'), m('SO', 'Southern'), m('DUK', 'Duke'), m('CEG', 'Constellation'), m('VST', 'Vistra')] },
  { etf: 'XLB', name: '原物料', desc: '化工、礦業、建材', holdings: [m('LIN', '林德'), m('SHW', '宣偉'), m('APD', '空氣化工'), m('FCX', '自由港'), m('NEM', '紐蒙特')] },
  { etf: 'XLRE', name: '不動產', desc: 'REITs：物流、通訊塔、資料中心', holdings: [m('PLD', '安博'), m('AMT', '美國電塔'), m('WELL', 'Welltower'), m('EQIX', 'Equinix'), m('SPG', '西蒙地產')] },
];

/** 某代號屬於哪些題材（台股用代號比對） */
export function themesOf(symbol: string): Theme[] {
  const code = symbol.replace(/\.(TW|TWO)$/, '');
  const isTw = /\.(TW|TWO)$/.test(symbol);
  return THEMES.filter((t) => (isTw ? t.tw : t.us).some((x) => x.code === code));
}

export function usSectorOf(symbol: string): UsSector | undefined {
  return US_SECTORS.find((s) => s.etf === symbol || s.holdings.some((h) => h.code === symbol));
}
