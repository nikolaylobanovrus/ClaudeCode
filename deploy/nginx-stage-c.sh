#!/usr/bin/env bash
# Две правки боевого nginx налог-сервис.рф. Запускать НА СЕРВЕРЕ, от root:
#
#   curl -fsSL https://raw.githubusercontent.com/nikolaylobanovrus/ClaudeCode/claude/tax-deduction-declaration-site-dfit30/deploy/nginx-stage-c.sh -o /tmp/nginx-stage-c.sh
#   less /tmp/nginx-stage-c.sh        # посмотреть, что именно он сделает
#   bash /tmp/nginx-stage-c.sh
#
# Что делает:
#   1. Cache-Control для HTML. Правило было написано как «location =
#      /index.html», а люди открывают «/» и «/deklaraciya/anketa» — такие
#      запросы под точное совпадение не попадали и уезжали вообще без
#      Cache-Control. Браузер кэшировал страницу «на своё усмотрение», и
#      вернувшийся посетитель часами видел ПРЕДЫДУЩУЮ сборку.
#   2. Этап C: честный 404. Было «try_files … /index.html» — любой
#      несуществующий адрес отдавал главную с кодом 200, и поисковик видел
#      бесконечное число одинаковых «страниц». Становится «=404» +
#      «error_page 404 /404.html».
#
# Почему скриптом, а не командой из переписки: боевой файл уже тронут certbot
# (он дописал 443-й блок), поэтому копировать конфиг из репозитория нельзя —
# снесёт TLS. Правки точечные, с резервной копией, проверкой и ОТКАТОМ.
#
# Скрипт идемпотентен: повторный запуск ничего не меняет.
set -euo pipefail

F=${1:-/etc/nginx/sites-available/nalog-servis}
HOST=xn----7sbhcltqolxje.xn--p1ai
WWW=/var/www/nalog-servis

[ -f "$F" ] || { echo "нет файла $F" >&2; exit 1; }
# Без страницы 404 директива error_page ведёт в никуда.
[ -f "$WWW/404.html" ] || { echo "нет $WWW/404.html — сначала выкладка" >&2; exit 1; }

BAK="$F.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$F" "$BAK"
echo "резервная копия: $BAK"

rollback() {
    trap - ERR            # внутри отката ловушка не нужна, иначе зацикливание
    echo "ОТКАТ: возвращаю $BAK" >&2
    cp -a "$BAK" "$F"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    exit 1
}
# Любая неожиданная ошибка (например правка не нашла своей строки) возвращает
# файл как было: иначе на диске остался бы недоправленный конфиг.
trap rollback ERR

count() { grep -cF "$1" "$F" || true; }

# --- Правка 1: Cache-Control для HTML --------------------------------------
if [ "$(count 'add_header Cache-Control "no-cache, must-revalidate" always;')" -gt 0 ]; then
    echo "1. Cache-Control для HTML — уже стоит, пропускаю"
else
    n=$(count 'index index.html;')
    [ "$n" = "1" ] || { echo "ожидалась одна строка «index index.html;», найдено $n" >&2; rollback; }
    python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "    index index.html;\n"
new = ("    index index.html;\n\n"
       "    # HTML кэшировать нельзя: иначе после выкладки человек часами видит\n"
       "    # ПРЕДЫДУЩУЮ сборку. На уровне server, а не «= /index.html»: люди\n"
       "    # открывают «/» и «/deklaraciya/anketa». В /assets/ свой add_header,\n"
       "    # он этот перекрывает (в nginx add_header из location ЗАМЕНЯЕТ\n"
       "    # унаследованный), поэтому immutable у ассетов остаётся.\n"
       '    add_header Cache-Control "no-cache, must-revalidate" always;\n')
assert s.count(old) == 1, s.count(old)
open(p, "w").write(s.replace(old, new, 1))
PY
    echo "1. Cache-Control для HTML — добавлено"
fi

# --- Правка 2: честный 404 (этап C) ----------------------------------------
if [ "$(count 'try_files $uri $uri/index.html =404;')" -gt 0 ]; then
    echo "2. честный 404 — уже стоит, пропускаю"
else
    n=$(count 'try_files $uri $uri/index.html /index.html;')
    [ "$n" = "1" ] || { echo "ожидался один SPA-фолбэк, найдено $n" >&2; rollback; }
    python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "        try_files $uri $uri/index.html /index.html;\n    }\n"
new = ("        try_files $uri $uri/index.html =404;\n    }\n"
       "    # Честный 404 вместо подмены главной (этап C). Безопасно потому,\n"
       "    # что в приложении нет маршрутов с параметрами, а каждый живой\n"
       "    # адрес лежит на диске отдельным файлом после пререндера.\n"
       "    error_page 404 /404.html;\n")
assert s.count(old) == 1, s.count(old)
open(p, "w").write(s.replace(old, new, 1))
PY
    echo "2. честный 404 — включено"
fi

# --- Проверка и перезагрузка ------------------------------------------------
nginx -t || rollback
systemctl reload nginx || rollback
echo "nginx перезагружен, проверяю живые адреса"

# Пробуем через https (после certbot 80-й порт редиректит), иначе http.
SCHEME=https; PORT=443
code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
         --resolve "$HOST:$PORT:127.0.0.1" "$SCHEME://$HOST$1" 2>/dev/null || echo 000; }
[ "$(code /)" = "200" ] || { SCHEME=http; PORT=80; }

bad=0
# Все страницы, которые реально лежат на диске: каждая обязана отдавать 200.
while read -r path; do
    c=$(code "$path")
    [ "$c" = "200" ] && continue
    echo "  ✗ $path → $c" >&2
    bad=$((bad + 1))
done < <(cd "$WWW" && find . -name index.html -printf '%P\n' \
         | sed 's|index\.html$||; s|/$||; s|^|/|')

# А несуществующий адрес обязан отдавать именно 404, и с нашей страницей.
c404=$(code /proverka-chestnogo-404-$RANDOM)
[ "$c404" = "404" ] || { echo "  ✗ несуществующий адрес → $c404, ожидался 404" >&2; bad=$((bad + 1)); }

if [ "$bad" != "0" ]; then
    echo "проблем: $bad" >&2
    rollback
fi

echo "✓ все страницы на месте, несуществующий адрес отдаёт 404"
echo "✓ готово. Откат при необходимости: cp -a $BAK $F && nginx -t && systemctl reload nginx"
