import urllib.request, urllib.parse, os, gzip, time, json
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            return str(r.status) + " " + r.read().decode("utf8","replace")
    except urllib.error.HTTPError as e:
        return str(e.code) + " " + e.read().decode("utf8","replace")
    except Exception as e:
        return "ERR " + str(e)
out = {}
for s in ["ANTW", "SPCX"]:
    for rg, iv in [("1y","1d"),("5y","1wk"),("max","1d"),("6mo","1d")]:
        out[s+"|"+rg] = get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s&includePrePost=false" % (s, rg, iv))[:2500]
        time.sleep(0.5)
json.dump(out, open("samples/ranges.json","w"), ensure_ascii=False)
