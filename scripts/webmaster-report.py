#!/usr/bin/env python3
"""Отчёт Яндекс.Вебмастера по налог-сервис.рф. Запускать НА VPS.

    curl -fsSL https://raw.githubusercontent.com/nikolaylobanovrus/ClaudeCode/claude/tax-deduction-declaration-site-dfit30/scripts/webmaster-report.py -o /tmp/webmaster-report.py
    python3 /tmp/webmaster-report.py              # отчёт, ничего не меняет
    python3 /tmp/webmaster-report.py --recrawl    # ещё и отправит страницы на переобход

ЗАЧЕМ ЗАПУСКАТЬ ИМЕННО НА СЕРВЕРЕ. Из среды разработки api.webmaster.yandex.net
недоступен: туннель устанавливается, TLS-привет уходит, и Яндекс рвёт
соединение по адресу дата-центра (проверено 16.10.2026, та же картина, что с
API Директа). С российского адреса VPS всё работает.

ТОКЕН берётся из переменной окружения YANDEX_WEBMASTER_OAUTH или из файла
/root/.ndfl-tokens (строка «YANDEX_WEBMASTER_OAUTH=…», права 600). В вывод
токен не попадает никогда.

Скрипт САМОДОСТАТОЧЕН: только стандартная библиотека, никаких импортов из
репозитория — на сервере его нет.

ЧТО ПОКАЗЫВАЕТ
  1. сводка: ИКС, страниц в поиске, исключено;
  2. как менялось число страниц в поиске за месяц;
  3. поисковые запросы: показы, клики, CTR, средняя позиция;
  4. страницы, которые реально показываются в выдаче;
  5. карта сайта: когда обработана, сколько адресов, ошибки;
  6. диагностика: что Вебмастер считает проблемой;
  7. квота переобхода (и сам переобход — по флагу --recrawl).

Вывод компактный и на русском: его можно целиком переслать в чат.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

# Адрес API можно подменить переменной WEBMASTER_API — этим скрипт
# проверяется на поддельном сервере там, где настоящий недоступен (в среде
# разработки Яндекс рвёт соединение). На сервере переменную не задают.
API = (os.environ.get("WEBMASTER_API") or "https://api.webmaster.yandex.net/v4").rstrip("/")
SITE_ASCII = "xn----7sbhcltqolxje.xn--p1ai"  # налог-сервис.рф в punycode
SITE_HUMAN = "налог-сервис.рф"
TOKENS_FILE = "/root/.ndfl-tokens"
DAYS = 28


def clean(v):
    """Убираем кавычки и УГЛОВЫЕ СКОБКИ.

    В инструкции образец был написан как «<токен>», и 16.10.2026 токен так и
    уехал в файл вместе со скобками: авторизация падала с 401, а причина была
    не видна. В настоящем токене Яндекса «<» и «>» не встречаются, так что
    снимать их безопасно.
    """
    return (v or "").strip().strip("\"'").strip("<>").strip()


def token():
    v = clean(os.environ.get("YANDEX_WEBMASTER_OAUTH"))
    if v:
        return v
    try:
        with open(TOKENS_FILE) as f:
            for line in f:
                if line.startswith("YANDEX_WEBMASTER_OAUTH="):
                    v = clean(line.split("=", 1)[1])
                    if v:
                        return v
    except OSError:
        pass
    sys.exit(
        "не найден YANDEX_WEBMASTER_OAUTH: ни в переменных окружения, ни в "
        + TOKENS_FILE
        + "\nПоложите токен туда и запустите снова."
    )


TOKEN = token()
# Токен Яндекса начинается с «y0_». Если пришло что-то другое — скажем сразу,
# а не после непонятного 401 из API.
if not TOKEN.startswith("y0"):
    print("Предупреждение: значение YANDEX_WEBMASTER_OAUTH не похоже на токен "
          "Яндекса (ожидается начало «y0_»). Если API ответит 401 — дело в этом.")


def api(path, params=None, method="GET", body=None):
    """Запрос к API. Возвращает (данные, None) или (None, «текст ошибки»).

    Ошибку НЕ поднимаем: один недоступный раздел не должен обрывать отчёт —
    лучше показать остальные и честно сказать, что именно не отдалось.
    """
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "OAuth " + TOKEN)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8", "replace")
            return (json.loads(raw) if raw else {}), None
    except urllib.error.HTTPError as e:
        txt = e.read().decode("utf-8", "replace")[:400]
        try:
            j = json.loads(txt)
            txt = j.get("error_message") or j.get("error_code") or txt
        except Exception:
            pass
        return None, "HTTP %s: %s" % (e.code, txt)
    except Exception as e:  # сеть, таймаут, TLS
        return None, str(e)[:200]


def head(title):
    print("\n" + title)
    print("─" * len(title))


def fail(where, err):
    print("  ✗ %s — %s" % (where, err))


# --- 1. Кто мы и какой сайт ---------------------------------------------------
me, err = api("/user/")
if err:
    sys.exit("не удалось обратиться к API Вебмастера: %s" % err)
user_id = me.get("user_id")

hosts, err = api("/user/%s/hosts" % user_id)
if err:
    sys.exit("не удалось получить список сайтов: %s" % err)

host = None
for h in hosts.get("hosts", []):
    if SITE_ASCII in (h.get("ascii_host_url") or "") or SITE_HUMAN in (
        h.get("unicode_host_url") or ""
    ):
        host = h
        break
if not host:
    print("Сайт %s не найден среди подтверждённых в Вебмастере." % SITE_HUMAN)
    print("Есть такие сайты:")
    for h in hosts.get("hosts", []):
        print("  ", h.get("unicode_host_url") or h.get("ascii_host_url"),
              "| подтверждён:", h.get("verified"))
    sys.exit(1)

host_id = host["host_id"]
print("Сайт: %s" % (host.get("unicode_host_url") or host.get("ascii_host_url")))
print("Подтверждён: %s" % ("да" if host.get("verified") else "НЕТ — часть данных закрыта"))

TO = date.today()
FROM = TO - timedelta(days=DAYS)
RANGE = {"date_from": FROM.isoformat(), "date_to": TO.isoformat()}

# --- 2. Сводка ----------------------------------------------------------------
head("Сводка")
summary, err = api("/user/%s/hosts/%s/summary" % (user_id, host_id))
if err:
    fail("сводка", err)
else:
    print("  ИКС: %s" % summary.get("sqi"))
    print("  страниц в поиске: %s" % summary.get("searchable_pages_count"))
    print("  исключено из поиска: %s" % summary.get("excluded_pages_count"))
    prob = summary.get("site_problems") or {}
    if prob:
        print("  проблемы по типам: %s" % json.dumps(prob, ensure_ascii=False))

# --- 3. Как менялось число страниц в поиске ----------------------------------
head("Страницы в поиске за %s дней" % DAYS)
hist, err = api(
    "/user/%s/hosts/%s/indexing/history" % (user_id, host_id),
    dict(RANGE, index_indicator_field=["SEARCHABLE", "DOWNLOADED", "EXCLUDED"]),
)
if err:
    fail("история индексации", err)
else:
    ind = hist.get("indicators") or {}
    for key, title in (("SEARCHABLE", "в поиске"), ("DOWNLOADED", "загружено"),
                       ("EXCLUDED", "исключено")):
        rows = [r for r in ind.get(key, []) if r.get("value") is not None]
        if not rows:
            continue
        first, last = rows[0], rows[-1]
        delta = (last["value"] or 0) - (first["value"] or 0)
        print("  %-10s %s → %s (%+d)" % (title, first["value"], last["value"], delta))

# --- 4. Поисковые запросы -----------------------------------------------------
head("Запросы за %s дней" % DAYS)
q, err = api(
    "/user/%s/hosts/%s/search-queries/popular" % (user_id, host_id),
    dict(
        RANGE,
        order_by="TOTAL_SHOWS",
        query_indicator=["TOTAL_SHOWS", "TOTAL_CLICKS", "AVG_SHOW_POSITION"],
        limit=25,
    ),
)
if err:
    fail("запросы", err)
else:
    rows = q.get("queries") or []
    if not rows:
        print("  пусто: показов за период не было")
    else:
        print("  %-42s %7s %7s %6s %6s" % ("запрос", "показы", "клики", "CTR", "поз."))
        for r in rows:
            i = r.get("indicators") or {}
            shows = i.get("TOTAL_SHOWS") or 0
            clicks = i.get("TOTAL_CLICKS") or 0
            pos = i.get("AVG_SHOW_POSITION")
            ctr = (clicks / shows * 100) if shows else 0
            print("  %-42s %7s %7s %5.1f%% %6s" % (
                (r.get("query_text") or "")[:42], shows, clicks, ctr,
                ("%.1f" % pos) if pos else "—"))

# --- 5. Страницы, которые показываются ---------------------------------------
head("Страницы в выдаче")
u, err = api(
    "/user/%s/hosts/%s/search-urls/popular" % (user_id, host_id),
    dict(RANGE, order_by="TOTAL_SHOWS",
         url_indicator=["TOTAL_SHOWS", "TOTAL_CLICKS"], limit=15),
)
if err:
    fail("страницы", err)
else:
    rows = u.get("urls") or []
    if not rows:
        print("  пусто: ни одна страница не показывалась")
    for r in rows:
        i = r.get("indicators") or {}
        print("  %7s показов %5s кликов  %s" % (
            i.get("TOTAL_SHOWS") or 0, i.get("TOTAL_CLICKS") or 0,
            urllib.parse.unquote(r.get("url") or "")))

# --- 6. Карта сайта -----------------------------------------------------------
head("Карта сайта")
sm, err = api("/user/%s/hosts/%s/sitemaps" % (user_id, host_id))
if err:
    fail("sitemap", err)
else:
    rows = sm.get("sitemaps") or []
    if not rows:
        print("  Вебмастер не знает ни одной карты сайта — её стоит добавить")
    for s in rows:
        print("  %s" % s.get("sitemap_url"))
        print("     обработана: %s | адресов: %s | ошибок: %s" % (
            (s.get("last_access_date") or "—")[:16],
            s.get("urls_count"), s.get("errors_count")))

# --- 7. Диагностика -----------------------------------------------------------
head("Диагностика")
d, err = api("/user/%s/hosts/%s/diagnostics/" % (user_id, host_id))
if err:
    fail("диагностика", err)
else:
    rows = [p for p in (d.get("problems") or []) if p.get("state") == "PRESENT"]
    if not rows:
        print("  проблем нет")
    for p in rows:
        print("  [%s] %s" % (p.get("severity"), p.get("problem_type")))

# --- 8. Переобход -------------------------------------------------------------
head("Переобход")
quota, err = api("/user/%s/hosts/%s/recrawl/quota" % (user_id, host_id))
if err:
    fail("квота переобхода", err)
else:
    print("  квота на сутки: %s, осталось: %s" % (
        quota.get("daily_quota"), quota.get("quota_remainder")))

if "--recrawl" in sys.argv:
    # Адреса берём из живой карты сайта — ровно то, что мы сами предлагаем
    # поисковику. Отдельного списка в скрипте нет намеренно: он бы устарел.
    try:
        with urllib.request.urlopen("https://%s/sitemap.xml" % SITE_ASCII, timeout=30) as r:
            xml = r.read().decode("utf-8", "replace")
        import re
        urls = re.findall(r"<loc>([^<]+)</loc>", xml)
    except Exception as e:
        urls = []
        print("  не удалось прочитать sitemap.xml: %s" % str(e)[:150])
    left = (quota or {}).get("quota_remainder")
    if left is not None:
        urls = urls[: int(left)]
    sent = 0
    for u_ in urls:
        _, e2 = api("/user/%s/hosts/%s/recrawl/queue" % (user_id, host_id),
                    method="POST", body={"url": u_})
        if e2:
            print("  ✗ %s — %s" % (u_, e2))
        else:
            sent += 1
    print("  отправлено на переобход: %s адресов" % sent)
else:
    print("  (чтобы отправить страницы на переобход, запустите с --recrawl)")

print("\nГотово. Этот вывод можно целиком переслать в чат.")
