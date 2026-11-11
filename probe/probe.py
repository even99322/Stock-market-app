import json, urllib.request, os, gzip, time
UA = "StockSim/1.0 even99322@users.noreply.github.com"
os.makedirs("samples", exist_ok=True)
def get(url, headers=None):
    h = {"User-Agent": UA, "Accept-Encoding": "gzip"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
            return r.status, b
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:2000]
    except Exception as e:
        return 0, str(e).encode()
def save(name, url, fn, headers=None):
    st, b = get(url, headers)
    out = {"url": url, "status": st, "bytes": len(b)}
    try:
        d = json.loads(b)
        out["sample"] = fn(d)
    except Exception as e:
        out["raw"] = b[:3000].decode("utf8", "replace"); out["err"] = str(e)
    json.dump(out, open(f"samples/{name}.json", "w"), ensure_ascii=False, indent=1)
    print(name, st, len(b))
    time.sleep(1)
FM = "https://api.finmindtrade.com/api/v4/data?dataset={}&data_id={}&start_date={}"
def fm(d):
    rows = d.get("data", [])
    types = {}
    for r in rows: types.setdefault(r.get("type"), r.get("origin_name"))
    return {"msg": d.get("msg"), "status": d.get("status"), "n": len(rows), "dates": sorted({r.get("date") for r in rows})[-6:], "first": rows[:3], "types": types}
save("fm_income", FM.format("TaiwanStockFinancialStatements", "2330", "2024-01-01"), fm)
save("fm_balance", FM.format("TaiwanStockBalanceSheet", "2330", "2025-01-01"), fm)
save("fm_cashflow", FM.format("TaiwanStockCashFlowsStatement", "2330", "2025-01-01"), fm)
save("fm_income_bank", FM.format("TaiwanStockFinancialStatements", "2881", "2025-01-01"), fm)
save("fm_revenue", FM.format("TaiwanStockMonthRevenue", "2330", "2025-01-01"), lambda d: {"msg": d.get("msg"), "n": len(d.get("data", [])), "rows": d.get("data", [])[-4:]})
def info(d):
    rows = d.get("data", [])
    cats = {}
    for r in rows: cats[r.get("industry_category")] = cats.get(r.get("industry_category"), 0) + 1
    return {"msg": d.get("msg"), "n": len(rows), "first": rows[:3], "tsmc": [r for r in rows if r.get("stock_id") in ("2330", "2317", "6488")], "cats": cats}
save("fm_info", "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo", info)
save("fm_chain", "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockIndustryChain&data_id=2330", lambda d: {"msg": d.get("msg"), "n": len(d.get("data", [])), "rows": d.get("data", [])[:10]})
first = lambda k: (lambda d: {"n": len(d), "first": d[:k]} if isinstance(d, list) else d)
save("twse_day_all", "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", first(3))
save("tpex_daily", "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes", first(3))
save("tpex_pe", "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis", first(2))
save("twse_basic", "https://openapi.twse.com.tw/v1/opendata/t187ap03_L", first(2))
save("tpex_basic", "https://www.tpex.org.tw/openapi/v1/mopsfe_company_basic_info", first(2))
save("twse_income", "https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci", first(2))
save("twse_balance", "https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci", first(2))
save("twse_revenue", "https://openapi.twse.com.tw/v1/opendata/t187ap05_L", first(2))
save("twse_mi_index", "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX", first(40))
save("twse_bfiamu", "https://openapi.twse.com.tw/v1/exchangeReport/BFIAMU", first(40))
save("sec_tickers", "https://www.sec.gov/files/company_tickers.json", lambda d: {"n": len(d), "first": [d[k] for k in list(d)[:3]]})
def cf(d):
    g = d.get("facts", {}).get("us-gaap", {})
    out = {"entityName": d.get("entityName"), "n_concepts": len(g), "keys": sorted(g)[:400]}
    for c in ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "NetIncomeLoss", "EarningsPerShareDiluted", "Assets", "NetCashProvidedByUsedInOperatingActivities"]:
        if c in g:
            u = g[c]["units"]; uk = list(u)[0]
            out[c] = {"label": g[c].get("label"), "unit": uk, "n": len(u[uk]), "last": u[uk][-8:]}
    return out
save("sec_facts_aapl", "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json", cf)
save("sec_submissions_aapl", "https://data.sec.gov/submissions/CIK0000320193.json", lambda d: {k: d.get(k) for k in ["name", "sic", "sicDescription", "tickers", "exchanges", "category", "fiscalYearEnd", "stateOfIncorporation", "description", "website"]})
def ymeta(d):
    r = d["chart"]["result"][0]; return {"meta": r["meta"]}
save("yahoo_xlk", "https://query1.finance.yahoo.com/v8/finance/chart/XLK?range=1d&interval=5m", ymeta)
save("yahoo_2330", "https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?range=5d&interval=1d", lambda d: {"meta": d["chart"]["result"][0]["meta"], "n": len(d["chart"]["result"][0].get("timestamp", []))})
save("yahoo_profile", "https://query2.finance.yahoo.com/v10/finance/quoteSummary/AAPL?modules=assetProfile", lambda d: d)
