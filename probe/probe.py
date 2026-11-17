import urllib.request, urllib.parse, os, gzip, time, json
os.makedirs("samples", exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
            return b.decode("utf8","replace")
    except Exception as e:
        return "ERR " + str(e)
out = {}
for q in ["Anthropic", "Anthropic AI Lab", "OpenAI", "SpaceX", "xAI"]:
    out["search:"+q] = get("https://query2.finance.yahoo.com/v1/finance/search?q=%s&quotesCount=15&newsCount=0&listsCount=0" % urllib.parse.quote(q))
    time.sleep(0.5)
syms = set()
for k,v in out.items():
    try:
        for r in json.loads(v).get("quotes", []): syms.add(r.get("symbol"))
    except Exception: pass
for s in sorted(x for x in syms if x)[:30]:
    out["chart:"+s] = get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=1mo&interval=1d" % urllib.parse.quote(s))[:3000]
    ts = "annualTotalRevenue,annualNetIncome,quarterlyTotalRevenue,quarterlyNetIncome,quarterlyDilutedEPS"
    out["fund:"+s] = get("https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/%s?type=%s&period1=1609459200&period2=1800000000" % (urllib.parse.quote(s), ts))[:3000]
    time.sleep(0.5)
json.dump(out, open("samples/anth.json","w"), ensure_ascii=False)
print("done")
