"""Проверка: какие ключевые фразы обходят собственные минус-слова.

Запуск: python3 scripts/direct-check-negative-conflicts.py  (по умолчанию
только показывает найденное; удаление — с аргументом --delete).


Директ игнорирует минус-слово, если оно встречается в самой ключевой фразе.
Поэтому «справка для налогового вычета» продолжала показываться, хотя
«справка» лежит в минусах кампании с 20.08 — и приносила клики по 10 ₽ за
человека, которому нужна справка, а не декларация.

Удаляем только то, где минус-слово поставлено осознанно и фраза ему
противоречит. Спорные оставляем: «санаторно» (вычет за санаторно-курортное
лечение существует), «нулевая» (нулевая декларация при продаже — наш
клиент), «сбербанк» (человек просто банк называет) — по ним отдельный
разговор о самих минус-словах.
"""
import sys

sys.path.insert(0, "/tmp/claude-0/-home-user-ClaudeCode/32df1caf-9816-5502-bab9-14aae6133905/scratchpad")
from direct import call  # токен читается из /root/.ndfl-tokens

CAMPAIGNS = [712712814, 713623101]


def conflicts():
    neg = set()
    for c in call("campaigns", "get", {"SelectionCriteria": {"Ids": CAMPAIGNS},
        "FieldNames": ["Id", "NegativeKeywords"]})["result"]["Campaigns"]:
        neg |= set((c.get("NegativeKeywords") or {}).get("Items", []))
    found = []
    for camp in CAMPAIGNS:
        off = None
        while True:
            p = {"SelectionCriteria": {"CampaignIds": [camp]},
                 "FieldNames": ["Id", "AdGroupId", "Keyword"], "Page": {"Limit": 10000}}
            if off:
                p["Page"]["Offset"] = off
            r = call("keywords", "get", p)["result"]
            for k in r.get("Keywords", []):
                words = set(k["Keyword"].replace("+", " ").replace("!", "").split())
                hit = words & neg
                if hit:
                    found.append((k, sorted(hit)))
            if "LimitedBy" in r:
                off = r["LimitedBy"]
            else:
                break
    return found


bad = conflicts()
print(f"фраз, конфликтующих с минус-словами: {len(bad)}")
for k, hit in bad:
    print(f"  {k['Keyword']}  ←  {', '.join(hit)}")

if "--delete" in sys.argv and bad:
    ids = [k["Id"] for k, _ in bad]
    r = call("keywords", "delete", {"SelectionCriteria": {"Ids": ids}})
    ok = sum(1 for x in r["result"]["DeleteResults"] if not x.get("Errors"))
    print(f"удалено: {ok} из {len(ids)}")
