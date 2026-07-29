# -*- coding: utf-8 -*-
"""Ежедневный отчёт по рекламе d-portret.ru: Директ (Reports API) + Метрика.

Использование: YANDEX_OAUTH_TOKEN=... python tools/direct_report.py [today|yesterday]
Токен НЕ хранится в репозитории — только через окружение/аргумент.
"""
import os
import sys

import requests

TOKEN = os.environ.get("YANDEX_OAUTH_TOKEN") or (sys.argv[2] if len(sys.argv) > 2 else "")
PERIOD = (sys.argv[1] if len(sys.argv) > 1 else "yesterday").upper()  # TODAY|YESTERDAY|LAST_7_DAYS
CAMPAIGNS = {713143936: "Поиск", 713143937: "РСЯ"}
COUNTER = 110971853
GOALS = {"order_start": 588220068, "reach_payment": 588220089, "purchase": 588220090}


def direct_report(date_range: str, report_type="CAMPAIGN_PERFORMANCE_REPORT",
                  fields=None, extra=None):
    fields = fields or ["CampaignId", "Impressions", "Clicks", "Ctr", "AvgCpc",
                        "Cost", "Conversions", "CostPerConversion"]
    body = {"params": {
        "SelectionCriteria": {"Filter": [{"Field": "CampaignId", "Operator": "IN",
                                          "Values": [str(c) for c in CAMPAIGNS]}]},
        "Goals": [str(GOALS["purchase"])],
        "FieldNames": fields,
        "ReportName": f"dp {report_type} {date_range} v3",
        "ReportType": report_type,
        "DateRangeType": date_range,
        "Format": "TSV", "IncludeVAT": "YES", "IncludeDiscount": "NO",
        **(extra or {})}}
    for _ in range(12):
        r = requests.post("https://api.direct.yandex.com/json/v5/reports", headers={
            "Authorization": f"Bearer {TOKEN}", "Accept-Language": "ru",
            "processingMode": "auto", "returnMoneyInMicros": "false",
            "skipReportHeader": "true", "skipReportSummary": "true"},
            json=body, timeout=90)
        if r.status_code == 200:
            lines = [ln.split("\t") for ln in r.text.strip().splitlines()]
            return lines[0], lines[1:] if len(lines) > 1 else []
        if r.status_code in (201, 202):
            import time
            time.sleep(int(r.headers.get("retryIn", "10")))
            continue
        raise SystemExit(f"reports: HTTP {r.status_code} {r.text[:300]}")
    raise SystemExit("reports: отчёт не готов после ретраев")


def metrika(date1, date2, filters=None):
    params = {"ids": COUNTER, "date1": date1, "date2": date2,
              "metrics": ",".join(["ym:s:visits"] +
                                  [f"ym:s:goal{g}reaches" for g in GOALS.values()]),
              "accuracy": "full"}
    if filters:
        params["filters"] = filters
    r = requests.get("https://api-metrika.yandex.net/stat/v1/data", params=params,
                     headers={"Authorization": f"OAuth {TOKEN}"}, timeout=60)
    d = r.json()
    if "totals" not in d:
        return None
    return dict(zip(["visits", "order_start", "reach_payment", "purchase"],
                    [round(x) for x in d["totals"]]))


def fmt_num(s):
    try:
        return f"{float(s):.2f}".rstrip("0").rstrip(".")
    except ValueError:
        return s or "0"


def main():
    if not TOKEN:
        sys.exit("Нет токена: задайте YANDEX_OAUTH_TOKEN")
    dr = {"TODAY": "TODAY", "YESTERDAY": "YESTERDAY"}.get(PERIOD, PERIOD)
    print(f"===== ДИРЕКТ · период {dr} =====")
    hdr, rows = direct_report(dr)
    total_cost = total_clicks = total_conv = 0.0
    if not rows:
        print("Показов/кликов за период нет.")
    for row in rows:
        d = dict(zip(hdr, row))
        name = CAMPAIGNS.get(int(d["CampaignId"]), d["CampaignId"])
        cost = float(d["Cost"]) if d["Cost"] != "--" else 0
        clicks = int(d["Clicks"]) if d["Clicks"] != "--" else 0
        conv = 0 if d.get("Conversions") in ("--", None, "") else int(d["Conversions"])
        total_cost += cost; total_clicks += clicks; total_conv += conv
        print(f"{name}: показы {d['Impressions']}, клики {clicks}, "
              f"CTR {fmt_num(d['Ctr'])}%, CPC {fmt_num(d['AvgCpc'])} ₽, "
              f"расход {fmt_num(d['Cost'])} ₽, покупок {conv}"
              + (f", CPO {fmt_num(d['CostPerConversion'])} ₽" if conv else ""))
    print(f"ИТОГО: {fmt_num(str(total_cost))} ₽, кликов {int(total_clicks)}, покупок {int(total_conv)}")

    print(f"\n===== ДИРЕКТ · группы (топ по кликам, {dr}) =====")
    hdr2, rows2 = direct_report(dr, "ADGROUP_PERFORMANCE_REPORT",
                                ["CampaignId", "AdGroupName", "Impressions", "Clicks",
                                 "Ctr", "Cost", "Conversions"])
    rows2 = [r for r in rows2 if r[3] not in ("0", "--")]
    rows2.sort(key=lambda r: -int(r[3]))
    for row in rows2[:10]:
        d = dict(zip(hdr2, row))
        conv = 0 if d.get("Conversions") in ("--", "") else d["Conversions"]
        print(f"  {d['AdGroupName']}: клики {d['Clicks']}, CTR {fmt_num(d['Ctr'])}%, "
              f"расход {fmt_num(d['Cost'])} ₽, покупок {conv}")
    if not rows2:
        print("  кликов по группам нет")

    print(f"\n===== ДИРЕКТ · поисковые запросы ({dr}) =====")
    hdr3, rows3 = direct_report(dr, "SEARCH_QUERY_PERFORMANCE_REPORT",
                                ["Query", "Impressions", "Clicks", "Cost"])
    rows3 = [r for r in rows3 if r[2] not in ("0", "--")]
    rows3.sort(key=lambda r: -int(r[2]))
    for row in rows3[:15]:
        d = dict(zip(hdr3, row))
        print(f"  «{d['Query']}»: клики {d['Clicks']}, {fmt_num(d['Cost'])} ₽")
    if not rows3:
        print("  кликов с поиска нет")

    m_date = {"TODAY": "today", "YESTERDAY": "yesterday"}.get(PERIOD, "yesterday")
    print(f"\n===== МЕТРИКА · {m_date} =====")
    allm = metrika(m_date, m_date)
    ya = metrika(m_date, m_date, "ym:s:lastSignUTMSource=='yandex'")
    if allm:
        print(f"Весь сайт: визиты {allm['visits']}, начали заказ {allm['order_start']}, "
              f"дошли до оплаты {allm['reach_payment']}, покупок {allm['purchase']}")
    if ya:
        print(f"Из Яндекса: визиты {ya['visits']}, начали заказ {ya['order_start']}, "
              f"дошли до оплаты {ya['reach_payment']}, покупок {ya['purchase']}")


if __name__ == "__main__":
    main()
