#!/usr/bin/env python3
"""Кандидаты в минус-слова: какие поисковые запросы вчера съели деньги зря.

    python3 scripts/direct-junk-queries.py --from 2026-09-10 --to 2026-09-10

Скрипт только ПОКАЗЫВАЕТ. Минус-слово добавляется руками после того, как
человек на него посмотрел, и вот почему: исключение площадки стоит копейки
и легко откатывается, а лишнее минус-слово молча выключает живой трафик и
обнаруживается через недели по просевшим кликам. Автоматизировать стоит
поиск, а не решение.

Две группы, за которыми следим отдельно:

1. «Ищу госорган» — человек искал телефон или адрес налоговой, попал к нам
   и звонит владельцу со словами «это налоговая?». С 09.09.2026 такие слова
   заминусованы в кампаниях «под ключ»; скрипт проверяет, не появились ли
   новые формулировки.

2. «Сделаю сам» — инструкции, образцы, бланки, программа «Декларация»,
   «бесплатно». Это не наш покупатель: он пришёл за инструкцией, а не за
   услугой. Заявок с таких запросов за всё время не было.

Отдельно печатаются дорогие клики без явных признаков мусора — их полезно
просматривать глазами: там попадаются и новые кластеры семантики.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request

CAMPAIGNS = [712712814, 713623101, 714198176]  # поисковые: у РСЯ запросов нет
API = "https://api.direct.yandex.com/json/v5/"
TOKENS = "/root/.ndfl-tokens"

GOV = re.compile(
    r"(налогов(ая|ой|ую)|фнс|инспекци)[^|]*?"
    r"(телефон|номер|горячая|адрес|режим|график|часы|где наход|как доехать|запис)"
    r"|(телефон|горячая лини|адрес|режим работы)[^|]*?(налогов|фнс|инспекц)"
    r"|личный кабинет налог|лк налогоплательщик|nalog ?ru|налог ?ру"
)
# ВНИМАНИЕ: сюда нельзя класть «курсы» и «обучение». У нас это вычет за
# обучение — живой товар, а не мусор: «вычет за курсы для ЕГЭ» и «проходила
# онлайн курсы, как вернуть 13 процентов» — это покупатели. Первая версия
# фильтра их отбраковывала.
DIY = re.compile(
    r"бесплатн|скачать|образец|образц|бланк|программ[аы] деклараци|"
    r"инструкц|пример заполнен|своими руками|пошагов|вакансии"
)


def oauth():
    with open(TOKENS) as f:
        for line in f:
            if line.startswith("YANDEX_OAUTH="):
                return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("не найден YANDEX_OAUTH в " + TOKENS)


def queries(token, date_from, date_to):
    spec = {
        "SelectionCriteria": {
            "DateFrom": date_from, "DateTo": date_to,
            "Filter": [{"Field": "CampaignId", "Operator": "IN",
                        "Values": [str(c) for c in CAMPAIGNS]}]},
        "FieldNames": ["CampaignId", "Query", "TargetingCategory",
                       "Impressions", "Clicks", "Cost"],
        "ReportName": "junk-%s-%s-%d" % (date_from, date_to, int(time.time())),
        "ReportType": "SEARCH_QUERY_PERFORMANCE_REPORT", "DateRangeType": "CUSTOM_DATE",
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


def show(title, rows):
    spend = sum(r[5] for r in rows)
    clicked = [r for r in rows if r[4] > 0]
    print("=== %s: %d запросов, с кликами %d, расход %.2f ₽"
          % (title, len(rows), len(clicked), spend))
    for r in sorted(rows, key=lambda x: (-x[5], -x[3]))[:25]:
        print("   %d %-56s пок %2d кл %d %6.2f ₽" % (r[0], r[1][:56], r[3], r[4], r[5]))
    print()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--from", dest="date_from", required=True)
    p.add_argument("--to", dest="date_to", required=True)
    a = p.parse_args()

    rows = []
    for line in queries(oauth(), a.date_from, a.date_to).splitlines():
        f = line.split("\t")
        if len(f) < 6 or f[0] == "CampaignId":
            continue
        rows.append((int(f[0]), f[1], f[2], int(f[3]), int(f[4]), float(f[5])))

    print("всего запросов %d, кликов %d, расход %.2f ₽\n"
          % (len(rows), sum(r[4] for r in rows), sum(r[5] for r in rows)))
    gov = [r for r in rows if GOV.search(r[1])]
    diy = [r for r in rows if DIY.search(r[1]) and r not in gov]
    show("«ищу госорган»", gov)
    show("«сделаю сам»", diy)

    rest = [r for r in rows if r[4] > 0 and r not in gov and r not in diy]
    print("=== дорогие клики без явных признаков мусора (смотреть глазами)")
    for r in sorted(rest, key=lambda x: -x[5])[:15]:
        print("   %d %-56s кл %d %6.2f ₽ %s" % (r[0], r[1][:56], r[4], r[5], r[2]))


if __name__ == "__main__":
    main()
