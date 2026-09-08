#!/usr/bin/env python3
"""Резервная копия таблицы orders из Supabase.

Зачем. На бесплатном тарифе Supabase резервных копий НЕТ: API отдаёт
`"backups": []` и `pitr_enabled: false` (проверено 08.09.2026). Единственная
копия истории оплат — та, что мы снимем сами.

Куда. Скрипт пишет ДВА файла:

  backups/orders-YYYY-MM-DD.json  — полный дамп; НЕ коммитится (.gitignore),
      потому что репозиторий публичный, а там clientID Метрики и
      идентификаторы платежей ЮKassa. Этот файл отдаётся владельцу.

  docs/orders-history.csv         — обезличенная сводка по дням (дата, число
      заказов, оплат, сумма). Её коммитить безопасно: ни одного
      идентификатора, только цифры. Нужна, чтобы история продаж пережила
      любую потерю доступа к Supabase.

Токен: SUPABASE_TOKEN из окружения или из /root/.ndfl-tokens (mode 600).
В репозиторий токен не попадает никогда.

Запуск:  python3 scripts/backup-orders.py
"""
import csv
import json
import os
import subprocess
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_REF = "iaogyzwnkrulhqbxotvf"
DUMP_DIR = ROOT / "backups"
HISTORY = ROOT / "docs" / "orders-history.csv"


def token():
    t = os.environ.get("SUPABASE_TOKEN", "").strip()
    if t:
        return t
    try:
        for line in Path("/root/.ndfl-tokens").read_text().splitlines():
            if line.startswith("SUPABASE_TOKEN="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    sys.exit("Нет SUPABASE_TOKEN: ни в окружении, ни в /root/.ndfl-tokens")


def query(sql):
    # User-Agent обязателен: без него Supabase Management API отвечает 403.
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": "Bearer " + token(),
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 ndfl-backup/1.0",
        },
    )
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


def main():
    rows = query("select * from orders order by created_at")
    if not rows:
        sys.exit("Supabase вернул пустой список — дамп не пишем, чтобы не затереть старый")

    # Дата берётся из данных, а не из системных часов: файл называется по
    # последнему заказу, поэтому повторный запуск в тот же день перезапишет
    # тот же файл, а не размножит копии.
    last = max(r["created_at"] for r in rows)[:10]
    DUMP_DIR.mkdir(exist_ok=True)
    dump = DUMP_DIR / f"orders-{last}.json"
    dump.write_text(json.dumps(rows, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

    # Обезличенная сводка по дням: только счётчики и суммы.
    days = defaultdict(lambda: {"created": 0, "paid": 0, "amount": 0})
    for r in rows:
        d = days[str(r["created_at"])[:10]]
        d["created"] += 1
        if r["status"] == "paid":
            d["paid"] += 1
            d["amount"] += int(r["amount"])
    HISTORY.parent.mkdir(exist_ok=True)
    with HISTORY.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["дата", "заказов_создано", "оплачено", "сумма_оплат_руб"])
        for day in sorted(days):
            v = days[day]
            w.writerow([day, v["created"], v["paid"], v["amount"]])

    paid = sum(1 for r in rows if r["status"] == "paid")
    total = sum(int(r["amount"]) for r in rows if r["status"] == "paid")
    print(f"Заказов: {len(rows)}, оплачено: {paid}, выручка: {total} ₽")
    print(f"Полный дамп (не коммитится): {dump}")
    print(f"Обезличенная сводка: {HISTORY}")

    # Страховка от случайного коммита персональных данных в публичный репозиторий.
    tracked = subprocess.run(
        ["git", "-C", str(ROOT), "check-ignore", "-q", str(dump)], check=False
    )
    if tracked.returncode != 0:
        sys.exit("ОШИБКА: backups/ не игнорируется git — дамп нельзя коммитить, репозиторий публичный")


if __name__ == "__main__":
    main()
