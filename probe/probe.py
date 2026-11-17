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
SY = """^N225 ^TPX ^TOPX 1306.T ^KS11 ^KQ11 ^HSI ^HSCE ^HSTECH 000001.SS 399001.SZ 000300.SS 399006.SZ ^NSEI ^BSESN ^AXJO ^STI ^JKSE ^SET.BK ^KLSE ^VNINDEX.VN VNM PSEI.PS ^NZ50
^STOXX50E ^STOXX ^GDAXI ^FCHI ^FTSE ^SSMI FTSEMIB.MI ^IBEX ^AEX ^OMX ^OMXS30 ^BFX ^ATX
^GSPTSE ^BVSP ^MXX ^MERV ^IPSA ^TASI.SR ^TA125.TA ^J203.JO ^JN0U.JO ^CASE30 XU100.IS
GBPTWD=X AUDTWD=X CADTWD=X SGDTWD=X CNYTWD=X KRWTWD=X THBTWD=X CHFTWD=X NZDTWD=X TWDJPY=X TWDKRW=X TWDCNY=X TWDTHB=X TWDVND=X
GBPUSD=X AUDUSD=X NZDUSD=X CAD=X CHF=X HKD=X SGD=X INR=X THB=X VND=X IDR=X MYR=X PHP=X CNH=X MXN=X BRL=X ZAR=X TRY=X EURJPY=X GBPJPY=X AUDJPY=X EURGBP=X
7203.T 6758.T 8035.T 9984.T 9983.T 6861.T 7974.T 005930.KS 000660.KS 373220.KS 0700.HK 9988.HK 1810.HK 3690.HK 0005.HK 1299.HK 600519.SS 300750.SZ 002594.SZ 601318.SS
ASML.AS SAP.DE SIE.DE MC.PA OR.PA NESN.SW NOVN.SW ROG.SW NOVO-B.CO SHEL.L AZN.L HSBA.L RELIANCE.NS TCS.NS BHP.AX CBA.AX D05.SI SHOP.TO RY.TO
^TWOII ^TWO 006201.TWO""".split()
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
print({k: {r: (v[r].get("n"), v[r].get("err")) for r in v} for k, v in out.items()})
