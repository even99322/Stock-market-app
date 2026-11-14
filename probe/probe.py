import urllib.request, os, gzip, time, json, urllib.parse, re, html
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
Q = [("umc_a","聯電","2026-01-06","2026-01-10"),("umc_b","聯電","2026-01-15","2026-01-22"),("umc_c","聯電","2026-01-26","2026-01-31"),
     ("hh_a","鴻海","2026-02-24","2026-02-28"),("hh_b","鴻海","2026-03-02","2026-03-06"),
     ("lg_a","大立光","2025-12-19","2025-12-24"),("lg_b","大立光","2025-12-28","2025-12-31"),
     ("mk_a","台股 大盤","2026-03-02","2026-03-05"),("mk_b","台股 大盤","2026-03-08","2026-03-12"),("mk_c","台股 大盤","2026-03-30","2026-04-02"),("mk_d","台股 大盤","2026-04-07","2026-04-09"),("mk_e","台股 大盤","2025-11-20","2025-11-23"),
     ("eva","長榮航","2026-02-28","2026-03-06"),("ym","陽明 貨櫃","2026-03-01","2026-03-07"),
     ("tsm_a","台積電 法說","2026-01-14","2026-01-18"),("tsm_b","台積電","2026-02-01","2026-02-08"),("mtk","聯發科","2026-01-22","2026-01-27")]
news = {}
for key, q, a, b in Q:
    u = "https://news.google.com/rss/search?hl=zh-TW&gl=TW&ceid=TW:zh-Hant&q=" + urllib.parse.quote(f"{q} after:{a} before:{b}")
    x = get(u).decode("utf8", "replace")
    items = []
    for it in re.findall(r"<item>(.*?)</item>", x, re.S)[:60]:
        g = lambda tag: (re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", it, re.S) or [None, ""])[1]
        items.append({"t": html.unescape(g("title")), "s": html.unescape(g("source")), "d": g("pubDate"), "l": g("link")})
    news[key] = {"q": q, "a": a, "b": b, "n": len(items), "items": items, "raw": x[:200] if not items else ""}
    time.sleep(1.2)
json.dump(news, open("samples/news.json", "w"), ensure_ascii=False, separators=(",", ":"))
FM = "https://api.finmindtrade.com/api/v4/data?dataset={}&data_id={}&start_date={}&end_date={}"
fm = {}
for sid in ["2303", "2317", "3008", "2330", "2618", "2609"]:
    fm[sid] = {}
    for ds, a, b in [("TaiwanStockMonthRevenue", "2025-01-01", "2026-07-01"), ("TaiwanStockFinancialStatements", "2025-01-01", "2026-07-01"),
                     ("TaiwanStockInstitutionalInvestorsBuySell", "2025-11-10", "2026-05-25"), ("TaiwanStockMarginPurchaseShortSale", "2025-11-10", "2026-05-25")]:
        try:
            d = json.loads(get(FM.format(ds, sid, a, b)))
            rows = d.get("data", [])
            if ds == "TaiwanStockFinancialStatements": rows = [r for r in rows if r["type"] in ("EPS", "Revenue", "GrossProfit", "OperatingIncome", "IncomeAfterTaxes")]
            fm[sid][ds] = {"msg": d.get("msg"), "rows": rows}
        except Exception as e:
            fm[sid][ds] = {"msg": str(e), "rows": []}
        time.sleep(1.2)
json.dump(fm, open("samples/fm.json", "w"), ensure_ascii=False, separators=(",", ":"))
print({k: v["n"] for k, v in news.items()})
print({k: {d: len(x["rows"]) for d, x in v.items()} for k, v in fm.items()})
