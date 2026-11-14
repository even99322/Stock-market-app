import urllib.request, os, gzip, time, json, urllib.parse
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url):
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                b = r.read()
                if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
                return b
        except Exception as e:
            err = str(e); time.sleep(2)
    return json.dumps({"err": err}).encode()
def chart(sym, rng, itv):
    d = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range={rng}&interval={itv}&includePrePost=false"))
    try:
        r = d["chart"]["result"][0]; q = r["indicators"]["quote"][0]; ts = r.get("timestamp") or []
        rows = [[ts[i], q["open"][i], q["high"][i], q["low"][i], q["close"][i], q["volume"][i]] for i in range(len(ts)) if q["close"][i] is not None and q["open"][i] is not None]
        rows = [[t, round(o, 2), round(h, 2), round(l, 2), round(c, 2), int(v or 0)] for t, o, h, l, c, v in rows]
        return {"gmtoffset": r["meta"].get("gmtoffset"), "name": r["meta"].get("longName") or r["meta"].get("shortName"), "bars": rows}
    except Exception as e:
        return {"err": str(d)[:300]}
TW = ["2330","2317","2454","2308","2382","3231","6669","2303","3711","2345","3017","3324","3661","3443","2603","2609","2615","2618","2881","2882","2891","1519","1503","2408","2344","8299","3008","2379","3034","2376","2356","4938","2059","3037","2383","6446","2002","1303","1301","2412","2912","0050","0056","00878"]
TWO = ["6488","5347","3293","5483","8069","6274","3105"]
US = ["NVDA","AAPL","TSLA","AMD","MSFT","META","AMZN","GOOGL","MU","AVGO","SMCI","TSM","INTC","PLTR"]
IDX = ["^TWII","^GSPC","^IXIC","^SOX","^VIX","TWD=X"]
daily = {}
for s in [x + ".TW" for x in TW] + [x + ".TWO" for x in TWO] + US + IDX:
    daily[s] = chart(s, "2y", "1d"); time.sleep(0.4)
json.dump(daily, open("samples/daily.json", "w"), separators=(",", ":"))
intra = {}
for s in ["2330.TW","2317.TW","3017.TW","2603.TW","2382.TW","^TWII"]:
    intra[s] = chart(s, "60d", "5m"); time.sleep(0.5)
json.dump(intra, open("samples/intra5m.json", "w"), separators=(",", ":"))
print({k: len(v.get("bars", [])) for k, v in daily.items()})
print({k: len(v.get("bars", [])) for k, v in intra.items()})
