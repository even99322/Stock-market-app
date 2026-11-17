import urllib.request, urllib.parse, os, gzip, time, json
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url):
    err = ""
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                b = r.read()
                if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
                return b
        except Exception as e:
            err = str(e); time.sleep(3)
    return ("ERR " + err).encode()
SY = ["TWD=X","JPY=X","EURUSD=X","CNY=X","JPYTWD=X","EURTWD=X","CNYTWD=X","HKDTWD=X","KRW=X","DX-Y.NYB","^TNX","^IRX","^TYX","^FVX",
      "ES=F","NQ=F","YM=F","RTY=F","NKD=F","GC=F","SI=F","HG=F","CL=F","BZ=F","NG=F","ZN=F","ZC=F","ZS=F","BTC-USD","ETH-USD",
      "^TWII","^TWOII","^N225","^HSI","^KS11","000001.SS","^GDAXI","^FTSE","^DJI","^RUT","^VIX","^SOX","WTX=F","TX=F","FITX=F","WTX&.TW","IX0126.TW"]
out = {}
for s in SY:
    o = {}
    for rg, iv in [("1d","5m"),("6mo","1d")]:
        try:
            d = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s" % (urllib.parse.quote(s) if hasattr(urllib,'parse') else s, rg, iv)))
            r = (d.get("chart",{}).get("result") or [None])[0]
            if not r: o[rg] = {"err": d.get("chart",{}).get("error")}; continue
            q = r["indicators"]["quote"][0]; ts = r.get("timestamp") or []
            vol = [v for v in (q.get("volume") or []) if v]
            o[rg] = {"meta": r["meta"], "n": len(ts), "nvol": len(vol), "first": ts[:2], "last": ts[-2:], "close": (q.get("close") or [])[-3:]}
        except Exception as e:
            o[rg] = {"err": str(e)}
        time.sleep(0.4)
    out[s] = o
json.dump(out, open("samples/yglobal.json","w"), ensure_ascii=False, separators=(",",":"))
fm = {}
for ds, did, a in [("TaiwanFuturesDaily","TX","2026-10-01"),("TaiwanFuturesDaily","MTX","2026-11-01"),("TaiwanFuturesDaily","TE","2026-11-01"),("TaiwanFutOptDailyInfo","","2026-11-01"),
                   ("TaiwanExchangeRate","USD","2026-10-01"),("TaiwanFuturesInstitutionalInvestors","TX","2026-10-15")]:
    u = "https://api.finmindtrade.com/api/v4/data?dataset=%s&start_date=%s" % (ds, a) + ("&data_id="+did if did else "")
    try:
        d = json.loads(get(u)); rows = d.get("data", [])
        fm[ds+":"+did] = {"msg": d.get("msg"), "status": d.get("status"), "n": len(rows), "head": rows[:6], "tail": rows[-40:]}
    except Exception as e:
        fm[ds+":"+did] = {"msg": str(e)}
    time.sleep(1.2)
json.dump(fm, open("samples/fmfut.json","w"), ensure_ascii=False, separators=(",",":"))
print({k: {r: (v[r].get("n"), v[r].get("err")) for r in v} for k, v in out.items()})
print({k: (v.get("msg"), v.get("n")) for k, v in fm.items()})
