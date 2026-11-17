import urllib.request, urllib.parse, os, gzip, time, json, statistics as st
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url, hdr=None):
    err = ""
    for k in range(3):
        try:
            h = {"User-Agent": UA}; h.update(hdr or {})
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r:
                b = r.read()
                if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
                return b
        except Exception as e:
            err = str(e); time.sleep(3)
    return ("ERR " + err).encode()
FX = ["TWD=X","JPYTWD=X","EURTWD=X","GBPTWD=X","HKDTWD=X","KRWTWD=X","SGDTWD=X","THBTWD=X","AUDTWD=X","NZDTWD=X","CADTWD=X","CHFTWD=X","TWDCNY=X",
      "CNY=X","JPY=X","EURUSD=X","GBPUSD=X","HKD=X","KRW=X","SGD=X","THB=X","AUDUSD=X","NZDUSD=X","CAD=X","CHF=X","INR=X","VND=X","IDR=X","MYR=X","PHP=X","MXN=X","BRL=X","ZAR=X","TRY=X","EURJPY=X","DX-Y.NYB"]
rep = {}; raw = {}
for s in FX:
    o = {}
    for rg, iv in [("1d","5m"),("5d","15m"),("1mo","1d"),("6mo","1d")]:
        d = get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s" % (urllib.parse.quote(s), rg, iv))
        try:
            j = json.loads(d); r = j["chart"]["result"][0]; q = r["indicators"]["quote"][0]; ts = r.get("timestamp") or []
            c = [x for x in q["close"] if x]; 
            med = st.median(c) if c else 0
            # 異常：收盤或高低偏離中位數 > 1.5%
            badc = sum(1 for x in c if abs(x/med-1) > 0.015)
            badhl = sum(1 for h,l in zip(q["high"],q["low"]) if h and l and (h/l-1) > 0.015)
            o[rg] = {"n": len(ts), "med": med, "min": min(c) if c else None, "max": max(c) if c else None, "badc": badc, "badhl": badhl,
                     "price": r["meta"].get("regularMarketPrice"), "prev": r["meta"].get("chartPreviousClose"), "pc2": r["meta"].get("previousClose")}
            if s in ("TWDCNY=X","TWD=X","CNY=X","JPYTWD=X") and rg in ("1d","5d","1mo"):
                raw[s+"|"+rg] = {"t": ts, "o": q["open"], "h": q["high"], "l": q["low"], "c": q["close"], "meta": r["meta"]}
        except Exception as e:
            o[rg] = {"err": str(e)[:200], "body": d[:200].decode("utf8","replace")}
        time.sleep(0.3)
    rep[s] = o
json.dump(rep, open("samples/fxq.json","w"), ensure_ascii=False, separators=(",",":"))
json.dump(raw, open("samples/fxraw.json","w"), ensure_ascii=False, separators=(",",":"))
# 臺灣銀行牌告匯率
bot = {}
for u in ["https://rate.bot.com.tw/xrt/flcsv/0/day", "https://rate.bot.com.tw/xrt/flcsv/0/L3M/USD", "https://rate.bot.com.tw/xrt/flcsv/0/L6M/CNY",
          "https://rate.bot.com.tw/xrt/flcsv/0/2026-11/JPY", "https://rate.bot.com.tw/xrt/quote/l6m/USD", "https://rate.bot.com.tw/xrt/flcsv/0/ltm/JPY"]:
    b = get(u)
    bot[u] = b.decode("utf-8-sig", "replace")[:6000]
    time.sleep(1)
json.dump(bot, open("samples/bot.json","w"), ensure_ascii=False)
# FinMind 匯率
fm = get("https://api.finmindtrade.com/api/v4/data?dataset=TaiwanExchangeRate&data_id=CNY&start_date=2026-08-01")
open("samples/fm_fx.json","wb").write(fm[:20000])
print("done")
