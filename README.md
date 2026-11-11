# 股市模擬學習平台（StockSim）

台股＋美股的模擬交易與學習程式。電腦用 Windows exe，手機用 Android App，兩邊共用同一份程式碼，可透過 Firebase 雲端同步帳戶。

## 功能

| 頁面 | 內容 |
|---|---|
| 市場 | 代號／中文名稱搜尋（台股全清單來自證交所、櫃買 OpenAPI）、大盤指數、自選股 |
| 個股 | K 線（1日～5年）、均線、布林通道、KD / RSI / MACD / OBV 副圖、今日與一年統計（波動度、最大回撤、夏普值…）、台股本益比／殖利率／股價淨值比、**指標白話解讀**、模擬下單 |
| 新聞・相關市場 | 個股相關新聞（Google 新聞彙整各大媒體、Yahoo Finance）；相關的大盤、匯率、期貨（含台指期）、ETF、ADR 同步報價 |
| 籌碼・股利 | 三大法人買賣超、融資融券、外資持股（台股）；歷次股利與除息日 |
| 風險控管 | 停損單、停利＋停損同時掛單、下單前風險試算（虧損金額、佔總資產比例、建議數量） |
| 板塊 | 台股產業依當日成交金額排行、熱門題材（AI 伺服器、散熱、記憶體…）、美股 11 大類股熱度 |
| 公司・財報 | 業務介紹、產業鏈位置、關聯公司與同業、財報重點與自動解讀、季/年財報、月營收圖表 |
| 帳戶 | 台幣、美元雙帳戶、持股損益、限價掛單、交易紀錄、換匯、資產曲線 |
| 回放 | 選一檔股票回到過去某天，逐日推進練習買賣，結束後和「買進持有」比較；可開盲測模式（隱藏名稱與日期）或隨機挑戰 |
| 學習 | 23 個主題（K 線、指標公式、基本面、風險指標、交易規則），每個數據旁的「?」都能直接打開 |

交易規則：台股手續費 0.1425% × 折數（最低 20 元，可調）、證交稅 0.3%（ETF 0.1%）、可用張或零股下單；美股預設零佣金。市價單以最新延遲報價成交；限價單會保留資金，每分鐘以分 K 檢查是否觸價成交。

行情來源：Yahoo Finance（延遲報價）。台股成交與產業分類來自證交所、櫃買中心 OpenAPI 與 FinMind；台股財報來自 FinMind，美股財報來自 Yahoo Finance；公司簡介部分來自中文維基百科。連不上網路時會自動改用「示範資料」並在畫面上標示，示範資料的價格是隨機產生的，不是真實行情。

## 下載安裝

到 [Releases](https://github.com/even99322/Stock-market-app/releases/latest) 下載最新版：

- **Windows**：`StockSim-Setup-x.y.z.exe`，雙擊即安裝（免管理員權限，裝在使用者資料夾）。第一次執行若出現 SmartScreen 警告，按「其他資訊 → 仍要執行」（程式沒有付費的程式碼簽章）。
- **Android**：`StockSim-x.y.z.apk`，用手機下載後點開安裝，系統會要求允許「安裝不明來源的應用程式」。

## 自動更新

| 平台 | 行為 |
|---|---|
| Windows | 啟動時與每 4 小時檢查一次，新版在背景下載；下載完成後關閉程式時自動安裝，也可在頂端提示列按「立即重新啟動並更新」。 |
| Android | 開啟 App 時檢查，有新版自動下載，完成後跳出系統安裝畫面，按「更新」即可。Android 不允許一般 App 靜默安裝，這一步一定要手動按。 |

更新不會清除資料（模擬帳戶、回放紀錄、設定都保留）。「設定 → 版本與更新」可以看目前版本、手動檢查。

## 發布新版本

```bash
npm run release -- patch "修正 xx；新增 yy"   # 1.0.0 → 1.0.1，內容以「；」分隔多項
npm run release -- minor "新增 zz 功能"        # 1.0.x → 1.1.0
```
這會修改 `package.json` 版本、寫入 `CHANGELOG.md`、commit 並 push。GitHub Actions（`.github/workflows/build.yml`）偵測到新版本號還沒有 Release，就會建置 Windows 安裝檔與 Android APK 並自動發布，約 8～10 分鐘後所有裝置就會收到更新。

只 push 而版本號沒變時，Actions 只會建置（可在 Actions 頁面下載測試用檔案），不會發布。

### 一次性設定（Android 簽章密鑰）
Android 的更新必須用同一把金鑰簽章，所以金鑰存在 GitHub Secrets（不放進程式碼）。到儲存庫 **Settings → Secrets and variables → Actions → New repository secret** 新增：

| 名稱 | 內容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 金鑰檔的 base64 字串 |
| `ANDROID_KEYSTORE_PASSWORD` | 金鑰密碼 |

金鑰請另外備份；遺失的話手機必須解除安裝再重裝新版（資料會清除，除非有開雲端同步或先匯出備份）。

### 自行在電腦建置
需要 Node.js 20 以上。
```bash
npm install
npm run dist:win        # Windows 安裝檔 → release/（需在 Windows 上執行）
npm run android:sync    # 然後用 Android Studio 開啟 android/ 資料夾建置
```

### 開發模式（瀏覽器）
```bash
npm install
npm run dev      # http://localhost:5173，行情透過 vite proxy 取得
npm test         # 指標、手續費、撮合邏輯的單元測試
```

## 雲端同步

App 已內建 Firebase 專案 `stocksim-e9205` 的設定，電腦和手機只要在「設定 → 雲端同步」用同一組 Email 登入即可同步（第一次按「註冊新帳號」）。也可以在同一處改貼自己的 `firebaseConfig`，或關閉同步。

同步方式：任何變更在 1～2 秒內上傳，另一台開著時即時更新；兩台都離線修改時以最後修改的為準，可用「以本機覆蓋雲端／以雲端覆蓋本機」手動處理。

### Firestore 安全規則自動部署
`firestore.rules` 修改並推到 `main` 後，`.github/workflows/firestore-rules.yml` 會用 Firebase Rules API 自動部署（先做語法檢查，失敗不會覆蓋線上規則）。需要儲存庫密鑰 `FIREBASE_SERVICE_ACCOUNT`：Google Cloud 服務帳戶金鑰 JSON，角色只給「Firebase Rules Admin」。

## 專案結構
```
src/lib/        核心邏輯（可直接閱讀學習）
  indicators.ts   MA / EMA / 布林 / RSI / MACD / KD / OBV
  stats.ts        報酬、波動、最大回撤、夏普值
  fees.ts         台股手續費與證交稅
  engine.ts       交易引擎：下單、限價撮合、換匯、回放
  market.ts       Yahoo 行情抓取（失敗時改用 demo.ts 示範資料）
  names.ts        代號搜尋、台股清單與本益比（證交所/櫃買 OpenAPI）
  sync.ts         Firebase 同步
  updater.ts      自動更新（前端）
  learn.ts        學習中心內容
src/pages/      各頁面   src/components/  圖表、下單面板等
electron/       Windows 桌面殼（代為抓取行情、electron-updater 自動更新）
android/        Capacitor Android 專案（ApkUpdaterPlugin.java 負責下載與安裝更新）
scripts/        release.mjs 發布腳本
```

## 已知限制
- 報價為延遲行情，非即時；限價單以分 K 觸價判斷，真實市場不一定能成交。
- 模擬帳戶不計股利與除權息，回放的報酬只計價差。
- 美股沒有本益比等基本面資料（Yahoo 的基本面 API 需要額外驗證）。
- 本程式僅供學習，不構成投資建議。
