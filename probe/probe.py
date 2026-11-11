import urllib.request, os, gzip, time, urllib.parse, json
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def raw(name, url, cut=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
            st = r.status
    except Exception as e:
        b = str(e).encode(); st = 0
    if cut: b = b[:cut]
    open(f"samples/{name}", "wb").write(b); print(name, st, len(b)); time.sleep(1)
    return b
G = "https://news.google.com/rss/search?hl=zh-TW&gl=TW&ceid=TW:zh-Hant&q="
raw("gn_2330.xml", G + urllib.parse.quote("台積電 2330 when:7d"), 30000)
raw("gn_nvda.xml", G + urllib.parse.quote("輝達 NVDA when:7d"), 20000)
raw("gn_tw.xml", G + urllib.parse.quote("台股 when:1d"), 12000)
raw("gn_en.xml", "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=" + urllib.parse.quote("NVDA stock when:7d"), 12000)
raw("ys_aapl.json", "https://query2.finance.yahoo.com/v1/finance/search?q=AAPL&quotesCount=0&newsCount=8&listsCount=0")
raw("ys_2330.json", "https://query2.finance.yahoo.com/v1/finance/search?q=2330.TW&quotesCount=0&newsCount=8&listsCount=0")
metas = {}
for s in ["ES=F","NQ=F","YM=F","^SOX","^VIX","DX-Y.NYB","^TNX","TWD=X","JPY=X","^TWOII","GC=F","CL=F","WTX=F","^N225","^HSI","BTC-USD","00631L.TW","SOXX","EWT"]:
    b = raw("tmp", f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(s)}?range=1d&interval=5m")
    try:
        r = json.loads(b)["chart"]["result"][0]; m = r["meta"]
        metas[s] = {k: m.get(k) for k in ["symbol","shortName","longName","instrumentType","regularMarketPrice","chartPreviousClose","previousClose","currency","fullExchangeName","gmtoffset"]}
        metas[s]["n"] = len(r.get("timestamp") or [])
    except Exception as e:
        metas[s] = {"err": b[:200].decode("utf8","replace")}
os.remove("samples/tmp")
json.dump(metas, open("samples/metas.json","w"), ensure_ascii=False, indent=1)
b = raw("taifex_raw.json", "https://openapi.taifex.com.tw/v1/DailyMarketReportFut")
try:
    d = json.loads(b); json.dump({"n": len(d), "tx": [r for r in d if r.get("Contract") in ("TX","MTX","TE","TF")][:8], "first": d[:2]}, open("samples/taifex.json","w"), ensure_ascii=False, indent=1)
except Exception as e:
    open("samples/taifex.json","w").write(str(e) + b[:500].decode("utf8","replace"))
os.remove("samples/taifex_raw.json")
