import urllib.request, os, gzip, time, urllib.parse
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def raw(name, url, headers=None):
    h = {"User-Agent": UA}; h.update(headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=90) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
    except Exception as e:
        b = str(e).encode()
    open(f"samples/{name}", "wb").write(b); print(name, len(b)); time.sleep(1.5)
FM = "https://api.finmindtrade.com/api/v4/data?dataset={}&data_id={}&start_date={}"
for sid in ["2330", "2881", "2603"]:
    raw(f"fm_is_{sid}.json", FM.format("TaiwanStockFinancialStatements", sid, "2023-01-01"))
    raw(f"fm_bs_{sid}.json", FM.format("TaiwanStockBalanceSheet", sid, "2023-01-01"))
    raw(f"fm_cf_{sid}.json", FM.format("TaiwanStockCashFlowsStatement", sid, "2023-01-01"))
    raw(f"fm_rev_{sid}.json", FM.format("TaiwanStockMonthRevenue", sid, "2023-01-01"))
raw("fm_info.json", "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo")
raw("twse_day_all.json", "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
raw("tpex_daily.json", "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes")
raw("twse_rev.json", "https://openapi.twse.com.tw/v1/opendata/t187ap05_L")
Q = ["TotalRevenue","CostOfRevenue","GrossProfit","OperatingExpense","OperatingIncome","PretaxIncome","NetIncome","NetIncomeCommonStockholders","DilutedEPS","ResearchAndDevelopment","TotalAssets","TotalLiabilitiesNetMinorityInterest","StockholdersEquity","CurrentAssets","CurrentLiabilities","CashAndCashEquivalents","Inventory","AccountsReceivable","OperatingCashFlow","CapitalExpenditure","FreeCashFlow"]
types = ",".join(["quarterly" + t for t in Q] + ["annual" + t for t in Q])
for s in ["AAPL", "JPM"]:
    raw(f"yts_{s}.json", f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{s}?symbol={s}&type={types}&period1=1640995200&period2=1830000000")
for s in ["XLK", "XLF"]:
    raw(f"y1d_{s}.json", f"https://query1.finance.yahoo.com/v8/finance/chart/{s}?range=1d&interval=5m")
W = {"User-Agent": "StockSim/1.0 (github.com/even99322/Stock-market-app)"}
for q in ["台積電", "Apple Inc. 公司", "緯穎"]:
    raw(f"wiki_{q.split()[0]}.json", "https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=extracts|info&inprop=url&exintro=1&explaintext=1&redirects=1&variant=zh-tw&format=json&origin=*&gsrsearch=" + urllib.parse.quote(q), W)
