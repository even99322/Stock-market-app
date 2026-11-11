import urllib.request, os, gzip, time, json
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def raw(name, url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
    except Exception as e:
        b = str(e).encode()
    open(f"samples/{name}", "wb").write(b); print(name, len(b)); time.sleep(1.5)
FM = "https://api.finmindtrade.com/api/v4/data?dataset={}&data_id={}&start_date={}"
for sid in ["2330", "2603"]:
    raw(f"fm_inst_{sid}.json", FM.format("TaiwanStockInstitutionalInvestorsBuySell", sid, "2026-08-15"))
    raw(f"fm_margin_{sid}.json", FM.format("TaiwanStockMarginPurchaseShortSale", sid, "2026-08-15"))
    raw(f"fm_hold_{sid}.json", FM.format("TaiwanStockShareholding", sid, "2026-08-15"))
    raw(f"fm_div_{sid}.json", FM.format("TaiwanStockDividend", sid, "2021-01-01"))
    raw(f"fm_divres_{sid}.json", FM.format("TaiwanStockDividendResult", sid, "2021-01-01"))
