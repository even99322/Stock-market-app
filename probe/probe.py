import json, urllib.request, os, gzip, time, http.cookiejar, urllib.parse
os.makedirs("samples", exist_ok=True)
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
BUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
def get(url, headers=None):
    h = {"User-Agent": BUA}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    try:
        with opener.open(req, timeout=60) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
            return r.status, b
    except urllib.error.HTTPError as e:
        b = e.read()
        try: b = gzip.decompress(b)
        except Exception: pass
        return e.code, b[:3000]
    except Exception as e:
        return 0, str(e).encode()
def save(name, url, fn=lambda d: d, headers=None, raw=False):
    st, b = get(url, headers)
    out = {"url": url, "status": st, "bytes": len(b)}
    try:
        if raw: raise ValueError("raw")
        out["sample"] = fn(json.loads(b))
    except Exception as e:
        out["raw"] = b[:4000].decode("utf8", "replace"); out["err"] = str(e)
    json.dump(out, open(f"samples/{name}.json", "w"), ensure_ascii=False, indent=1)
    print(name, st, len(b)); time.sleep(1)
    return st, b
T = "quarterlyTotalRevenue,quarterlyGrossProfit,quarterlyOperatingIncome,quarterlyNetIncome,quarterlyDilutedEPS,quarterlyTotalAssets,quarterlyTotalLiabilitiesNetMinorityInterest,quarterlyStockholdersEquity,quarterlyOperatingCashFlow,quarterlyCapitalExpenditure,quarterlyFreeCashFlow,annualTotalRevenue,annualNetIncome,annualDilutedEPS"
def ts(d):
    res = d.get("timeseries", {}).get("result", [])
    return {"error": d.get("timeseries", {}).get("error"), "n": len(res), "items": [{k: (v[-2:] if isinstance(v, list) else v) for k, v in r.items()} for r in res[:6]]}
save("yahoo_timeseries", f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/AAPL?symbol=AAPL&type={T}&period1=1600000000&period2=1800000000", ts)
save("yahoo_timeseries_tw", f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/2330.TW?symbol=2330.TW&type=quarterlyTotalRevenue,quarterlyNetIncome&period1=1700000000&period2=1800000000", ts)
# crumb flow
st, _ = get("https://fc.yahoo.com/")
st2, crumb = get("https://query1.finance.yahoo.com/v1/test/getcrumb")
json.dump({"fc": st, "crumb_status": st2, "crumb": crumb.decode("utf8", "replace")[:100], "cookies": [c.name for c in cj]}, open("samples/yahoo_crumb.json", "w"))
c = urllib.parse.quote(crumb.decode("utf8", "replace"))
save("yahoo_profile_crumb", f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/AAPL?modules=assetProfile,financialData,defaultKeyStatistics&crumb={c}", lambda d: d)
save("yahoo_profile_tw", f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/2330.TW?modules=assetProfile&crumb={c}", lambda d: d)
save("sec_tickers2", "https://www.sec.gov/files/company_tickers.json", lambda d: {"n": len(d), "first": [d[k] for k in list(d)[:3]]}, headers={"User-Agent": "StockSim/1.0 stocksim.app@gmail.com"})
save("sec_facts2", "https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/NetIncomeLoss.json", lambda d: {"n": len(d["units"]["USD"]), "last": d["units"]["USD"][-5:]}, headers={"User-Agent": "StockSim/1.0 stocksim.app@gmail.com"})
save("wiki_zh", "https://zh.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote("台灣積體電路製造"), lambda d: {"title": d.get("title"), "extract": d.get("extract"), "desc": d.get("description")}, headers={"Accept-Language": "zh-tw", "User-Agent": "StockSim/1.0 (github.com/even99322/Stock-market-app)"})
save("wiki_search", "https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + urllib.parse.quote("鴻海 公司") + "&format=json&srlimit=3&origin=*", lambda d: d, headers={"User-Agent": "StockSim/1.0 (github.com/even99322/Stock-market-app)"})
save("wiki_extract", "https://zh.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&variant=zh-tw&titles=" + urllib.parse.quote("鴻海精密工業") + "&format=json&origin=*", lambda d: d, headers={"User-Agent": "StockSim/1.0 (github.com/even99322/Stock-market-app)"})
save("fm_info_one", "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=2330", lambda d: d)
