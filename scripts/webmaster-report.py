#!/usr/bin/env python3
"""Отчёт Яндекс.Вебмастера по налог-сервис.рф. Запускать НА VPS.

    curl -fsSL https://raw.githubusercontent.com/nikolaylobanovrus/ClaudeCode/claude/tax-deduction-declaration-site-dfit30/scripts/webmaster-report.py -o /tmp/webmaster-report.py
    python3 /tmp/webmaster-report.py              # отчёт, ничего не меняет
    python3 /tmp/webmaster-report.py --recrawl    # ещё и отправит страницы на переобход
                                                  # (и добавит sitemap.xml, если Вебмастер
                                                  # не знает ни одной карты сайта)

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
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

# ТОЛЬКО IPv4.
#
# 16.10.2026 на VPS скрипт падал с «[Errno 101] Network is unreachable»: у
# api.webmaster.yandex.net есть AAAA-запись, python берёт её первой, а у
# сервера маршрута IPv6 нет — соединение не устанавливается вообще, хотя по
# IPv4 всё доступно. Запрещаем IPv6 на уровне разрешения имён: и сайт, и API
# по IPv4 работают, терять нечего.
_getaddrinfo = socket.getaddrinfo


def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    return _getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


if "--any-ip" not in sys.argv:  # на случай сети, где IPv4 вдруг нет
    socket.getaddrinfo = _ipv4_only

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


def token_files():
    """Где ищем файл с токеном — по порядку.

    Скрипт запускают и на сервере, и с домашнего компьютера (API Вебмастера
    закрыт для адресов дата-центров — проверено 16.10.2026 и в среде
    разработки, и на VPS: TCP 443 к api.webmaster.yandex.net не открывается,
    при живом API Метрики с того же адреса). Поэтому кроме серверного пути
    смотрим домашний каталог и путь из --token-file: на Windows «/root» нет.
    """
    out = []
    if "--token-file" in sys.argv:
        i = sys.argv.index("--token-file")
        if i + 1 < len(sys.argv):
            out.append(sys.argv[i + 1])
    out.append(TOKENS_FILE)
    out.append(os.path.join(os.path.expanduser("~"), ".ndfl-tokens"))
    return out


def token():
    v = clean(os.environ.get("YANDEX_WEBMASTER_OAUTH"))
    if v:
        return v
    for path in token_files():
        try:
            with open(path) as f:
                for line in f:
                    if line.startswith("YANDEX_WEBMASTER_OAUTH="):
                        v = clean(line.split("=", 1)[1])
                        if v:
                            return v
        except OSError:
            continue
    sys.exit(
        "не найден YANDEX_WEBMASTER_OAUTH.\n"
        "Искал: переменную окружения и файлы:\n  "
        + "\n  ".join(token_files())
        + "\n\nНа сервере:  umask 077 && printf 'YANDEX_WEBMASTER_OAUTH=ТОКЕН\\n' > /root/.ndfl-tokens"
        + "\nНа Windows:  $env:YANDEX_WEBMASTER_OAUTH=\"ТОКЕН\"  (в том же окне PowerShell)"
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
# NOT_LOADED — Вебмастер ещё не загрузил данные по сайту: сводка, запросы и
# история отвечают 404. Так было 27.10.2026, через 12 дней после
# подтверждения (15.10). Говорим об этом сразу, чтобы череда 404 ниже не
# читалась как поломка скрипта.
info, _ = api("/user/%s/hosts/%s" % (user_id, host_id))
status = (info or {}).get("host_data_status")
if status and status != "OK":
    print("Данные сайта в Вебмастере: %s — %s" % (status, {
        "NOT_LOADED": "ещё не загружены, сводка и запросы будут пустыми",
        "NOT_INDEXED": "сайт ещё не проиндексирован",
    }.get(status, "см. интерфейс Вебмастера")))

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
        # Строка «Sitemap:» в robots.txt есть, но пока данные сайта не
        # загружены, Вебмастер её не видит. Добавляем карту явно — под тем же
        # флагом, что и переобход: без флагов скрипт ничего не меняет.
        added, _ = api("/user/%s/hosts/%s/user-added-sitemaps" % (user_id, host_id))
        if (added or {}).get("count"):
            print("  карта добавлена вручную, Вебмастер её ещё не обработал")
        elif "--recrawl" in sys.argv:
            _, e3 = api("/user/%s/hosts/%s/user-added-sitemaps" % (user_id, host_id),
                        method="POST", body={"url": "https://%s/sitemap.xml" % SITE_ASCII})
            print("  ✗ не удалось добавить sitemap.xml — %s" % e3 if e3
                  else "  sitemap.xml добавлена в Вебмастер")
        else:
            print("  Вебмастер не знает ни одной карты сайта — добавится при запуске с --recrawl")
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
    # API отдаёт словарь {тип: {severity, state}}, а не список: первая версия
    # перебирала его как список и падала на первом же запуске (27.10.2026).
    probs = d.get("problems") or {}
    rows = [(k, v) for k, v in probs.items() if (v or {}).get("state") == "PRESENT"]
    if not rows:
        print("  проблем нет")
    for k, v in rows:
        print("  [%s] %s" % (v.get("severity"), k))

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
        # Сначала самые свежие страницы (по lastmod): если квота кончится,
        # пусть недополучат переобход старые, давно известные адреса.
        pairs = re.findall(r"<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]+)</lastmod>)?", xml)
        urls = [u for u, _ in sorted(pairs, key=lambda x: x[1] or "", reverse=True)]
        # В карте адреса кириллические, а сайт в API заведён в punycode —
        # отправляем в том же написании, что и host_id.
        urls = [u.replace("://" + SITE_HUMAN, "://" + SITE_ASCII) for u in urls]
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
