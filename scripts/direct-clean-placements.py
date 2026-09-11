#!/usr/bin/env python3
"""Ежедневная чистка площадок РСЯ: исключаем мобильные приложения.

    python3 scripts/direct-clean-placements.py            # показать, что нашлось
    python3 scripts/direct-clean-placements.py --apply    # применить

Зачем. В РСЯ половина показов уходит в мобильные игры и утилиты: там
случайные клики по баннеру, человек не искал декларацию и уходит сразу.
За 04–10.09.2026 такие площадки съели 128 ₽ при нуле заявок. Список
пополняется сам собой — каждый день всплывают новые пакеты, поэтому чистка
нужна регулярная, а не разовая.

Как отличаем приложение от сайта. У сайта домен кончается известной зоной
(.ru, .com, …), у приложения имя — это идентификатор пакета:
«com.blockpuzzle.us.ios», «ru.mail.mailapp», «puzzle.blockpuzzle.cube.relax».
Проверка «домен не кончается известной зоной» даёт ровно это и не задевает
ни dzen.ru, ни m.mail.yandex.ru, ни tests24.su.

Что НЕ трогаем:
  * площадки без кликов — исключать нечего, показы бесплатны;
  * dsp.yandex.ru и прочие агрегаторы Яндекса — за ними стоят тысячи
    площадок сразу, исключение убило бы охват целиком;
  * обычные сайты, даже мусорные на вид: у них другой разбор (по отказам),
    и ошибиться там дороже.

Токен берётся из /root/.ndfl-tokens (строка YANDEX_OAUTH=...). В репозиторий
файл не кладём и в вывод не печатаем.
"""
import argparse
import collections
import json
import re
import sys
import time
import urllib.error
import urllib.request

CAMPAIGNS = [712863931, 714198177]  # РСЯ: ретаргетинг и «под ключ»
API = "https://api.direct.yandex.com/json/v5/"
TOKENS = "/root/.ndfl-tokens"

# Зоны, после которых имя — это сайт, а не пакет приложения.
TLD = re.compile(
    r"\.(ru|com|org|net|io|tv|info|pro|me|ua|by|kz|su|am|ge|рф|online|site|"
    r"club|biz|top|xyz|app|store|shop|fun|space|website|press|news)$"
)
# Агрегаторы: формально не сайт и не приложение, исключать нельзя.
KEEP = {"dsp.yandex.ru", "dsp-mintagral.yandex.ru", "yandex.ru"}


def oauth():
    with open(TOKENS) as f:
        for line in f:
            if line.startswith("YANDEX_OAUTH="):
                return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("не найден YANDEX_OAUTH в " + TOKENS)


def direct(token, service, method, params):
    body = json.dumps({"method": method, "params": params}, ensure_ascii=False).encode()
    req = urllib.request.Request(
        API + service, data=body,
        headers={"Authorization": "Bearer " + token, "Accept-Language": "ru",
                 "Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def placements(token, date_from, date_to):
    """Отчёт по площадкам. Он готовится не мгновенно — 201/202 значит «ещё считаю»."""
    spec = {
        "SelectionCriteria": {
            "DateFrom": date_from, "DateTo": date_to,
            "Filter": [{"Field": "CampaignId", "Operator": "IN",
                        "Values": [str(c) for c in CAMPAIGNS]}]},
        "FieldNames": ["CampaignId", "Placement", "Impressions", "Clicks", "Cost"],
        "ReportName": "placements-%s-%s-%d" % (date_from, date_to, int(time.time())),
        "ReportType": "CUSTOM_REPORT", "DateRangeType": "CUSTOM_DATE",
        "Format": "TSV", "IncludeVAT": "YES", "IncludeDiscount": "NO",
    }
    body = json.dumps({"params": spec}, ensure_ascii=False).encode()
    headers = {"Authorization": "Bearer " + token, "Accept-Language": "ru",
               "Content-Type": "application/json; charset=utf-8",
               "processingMode": "auto", "returnMoneyInMicros": "false",
               "skipReportHeader": "true", "skipReportSummary": "true"}
    for _ in range(12):
        try:
            req = urllib.request.Request(API + "reports", data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as r:
                if r.status == 200:
                    return r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code not in (201, 202):
                sys.exit("отчёт не собрался: %s %s" % (e.code, e.read().decode()[:400]))
        time.sleep(5)
    sys.exit("отчёт не собрался за отведённое время")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--from", dest="date_from", required=True, help="ГГГГ-ММ-ДД")
    p.add_argument("--to", dest="date_to", required=True, help="ГГГГ-ММ-ДД")
    p.add_argument("--apply", action="store_true", help="применить, а не только показать")
    a = p.parse_args()

    token = oauth()
    got = direct(token, "campaigns", "get",
                 {"SelectionCriteria": {"Ids": CAMPAIGNS},
                  "FieldNames": ["Id", "Name", "ExcludedSites"]})
    current, names = {}, {}
    for c in got["result"]["Campaigns"]:
        current[c["Id"]] = list(c.get("ExcludedSites", {}).get("Items", []) or [])
        names[c["Id"]] = c["Name"]

    stats = collections.defaultdict(lambda: [0, 0, 0.0])
    for line in placements(token, a.date_from, a.date_to).splitlines():
        f = line.split("\t")
        if len(f) < 5 or f[0] == "CampaignId":
            continue
        v = stats[(int(f[0]), f[1])]
        v[0] += int(f[2]); v[1] += int(f[3]); v[2] += float(f[4])

    # Сверяем БЕЗ учёта регистра: отчёт отдаёт «com.MadOut.BIG», а Директ
    # хранит исключение приведённым к нижнему регистру. При точном сравнении
    # такие площадки находились бы каждый день заново и список рос бы вечно.
    known = {cid: {s.lower() for s in items} for cid, items in current.items()}
    found = collections.defaultdict(list)
    for (cid, site), v in stats.items():
        if v[1] == 0 or site.lower() in KEEP or site.lower() in known.get(cid, ()):
            continue
        if not TLD.search(site.lower()):
            found[cid].append((site.lower(), v[1], v[2]))

    total = 0.0
    for cid in CAMPAIGNS:
        items = sorted(found.get(cid, []), key=lambda x: -x[2])
        waste = sum(i[2] for i in items)
        total += waste
        print("%s (%d): нашлось %d, расход %.2f ₽" % (names[cid], cid, len(items), waste))
        for site, clicks, cost in items:
            print("   %-45s кл %2d  %6.2f ₽" % (site, clicks, cost))
    print("ИТОГО впустую: %.2f ₽" % total)

    if not a.apply:
        print("\nэто предпросмотр — добавьте --apply, чтобы исключить")
        return
    if not found:
        print("\nисключать нечего")
        return
    ups = []
    for cid, items in found.items():
        merged = sorted(set(current[cid]) | {i[0] for i in items})
        ups.append({"Id": cid, "ExcludedSites": {"Items": merged}})
        print("\n%d: было %d → стало %d" % (cid, len(current[cid]), len(merged)))
    res = direct(token, "campaigns", "update", {"Campaigns": ups})
    for r in res.get("result", {}).get("UpdateResults", []):
        print("  %d: %s" % (r["Id"], r.get("Errors") or "OK"))


if __name__ == "__main__":
    main()
