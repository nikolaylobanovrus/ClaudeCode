#!/usr/bin/env bash
# Серверная часть выкладки налог-сервис.рф: тянем собранный сайт из git.
#
# Почему так, а не rsync по SSH: среда, из которой ведётся разработка,
# ходит наружу только по HTTPS — SSH оттуда недоступен. Поэтому инициатива
# у сервера: он периодически забирает ветку с готовой сборкой. Та же схема,
# что у соседнего проекта (headshot-bot/deploy/self_deploy.sh).
#
# С 19.10.2026 этим же каналом едут ПРАВКИ NGINX — раньше их приходилось
# применять вручную, запуская скрипт на сервере (так ставился этап C).
# Теперь правка описывается файлом в deploy/nginx.d/, попадает в сборку и
# применяется здесь: с резервной копией, проверкой «nginx -t», проверкой
# живых адресов и откатом при любой беде. Подробности и формат —
# deploy/nginx.d/README.md.
#
# Ставится один раз, дальше работает по таймеру systemd.
set -euo pipefail

REPO=https://github.com/nikolaylobanovrus/ClaudeCode.git
BRANCH="${DEPLOY_BRANCH:-deploy/nalog-servis-dist}"
SRC=/root/nalog-servis-dist
WWW=/var/www/nalog-servis
CONF=/etc/nginx/sites-available/nalog-servis
HOST=xn----7sbhcltqolxje.xn--p1ai

mkdir -p "$WWW"
if [ ! -d "$SRC/.git" ]; then
    rm -rf "$SRC"
    git clone -q --depth 1 -b "$BRANCH" "$REPO" "$SRC"
else
    git -C "$SRC" fetch -q --depth 1 origin "$BRANCH"
    git -C "$SRC" reset -q --hard "origin/$BRANCH"
fi

HEAD=$(git -C "$SRC" rev-parse --short HEAD)

# Ассеты прошлых сборок удаляются НЕ СРАЗУ, а через трое суток.
#
# Раньше здесь стоял rsync --delete, и куски прежней сборки исчезали в тот же
# миг. У людей с открытой вкладкой адреса этих кусков уже в памяти страницы:
# они содержат хеш содержимого и после выкладки ведут в 404. Ленивая подгрузка
# падает, и человек видит не анкету, а экран аварии — ничего неправильного он
# при этом не делал. Мобильный Safari держит вкладки открытыми сутками.
#
# Оговорка о поводе: 11–13.09.2026 цель render_error поймала пять таких
# ошибок с iPhone, и я сперва объяснил их этой самой выкладкой. Разбор не
# подтвердил: четверо из пяти были НОВЫМИ посетителями с одним просмотром
# страницы, а у нового посетителя старой вкладки нет — скорее всего они
# просто ушли, не дождавшись загрузки. Отсрочка удаления всё равно нужна:
# она закрывает настоящий случай (вкладка, открытая до выкладки), просто он
# оказался не тем, что мы измеряли.
#
# Поэтому: сначала кладём новое, ничего не удаляя; помечаем текущим временем
# ВСЁ, что входит в свежую сборку; удаляем только то, чего в сборках не было
# трое суток. Отметка времени обязательна — git не хранит mtime, и файл,
# не менявшийся несколько выкладок подряд, иначе выглядел бы старым.
#
# Каталог _server/ в веб-корень НЕ едет: там серверные файлы (правки nginx),
# и посетителям они не предназначены.
rsync -a --exclude .git --exclude _server "$SRC"/ "$WWW"/
(cd "$SRC" && find . -type f ! -path './.git/*' ! -path './_server/*' -print0) |
    (cd "$WWW" && xargs -0 -r touch)
find "$WWW" -mindepth 1 -type f -mtime +3 -delete
find "$WWW" -mindepth 1 -type d -empty -delete

# --- Правки nginx -----------------------------------------------------------
#
# Сервер исполняет только ЭТОТ скрипт, установленный вручную. Из репозитория
# приходит описание правки (JSON), а не код: репозиторий публичный, и
# выполнять присланное оттуда на боевой машине нельзя. Набор действий узкий —
# найти кусок текста в одном файле и заменить его.
NGINX_RESULT=none
NGINX_APPLIED=""

apply_nginx() {
    local dir="$SRC/_server/nginx.d"
    [ -d "$dir" ] || return 0
    if [ ! -f "$CONF" ]; then
        NGINX_RESULT="нет $CONF"
        return 0
    fi

    local tmp bak out
    tmp=$(mktemp)
    if ! out=$(python3 - "$CONF" "$dir" "$tmp" <<'PY'
import json, pathlib, re, sys

conf_path, patch_dir, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
# Ровно тот же список, что проверяется до выкладки (scripts/check-nginx-patches.py).
# Дублирование намеренное: проверка «у себя» ловит ошибку раньше, но решает
# всё равно сервер — он не обязан доверять тому, что ему прислали.
FORBIDDEN = ["ssl_certificate", "proxy_pass", "fastcgi_pass", "server_name",
             "listen", "include", "alias", "root", "user ", "load_module"]
REQUIRED = ("id", "why", "done_marker", "find", "expect", "replace")

conf = pathlib.Path(conf_path).read_text()
applied = []
for f in sorted(pathlib.Path(patch_dir).glob("*.json")):
    p = json.loads(f.read_text())
    if any(k not in p for k in REQUIRED):
        sys.exit(f"{f.name}: не хватает обязательных полей")
    bad = [d for d in FORBIDDEN if re.search(r"(?m)^\s*" + re.escape(d), p["replace"])]
    if bad:
        sys.exit(f"{f.name}: запрещённые директивы — {', '.join(bad)}")
    if p["done_marker"] in conf:
        continue                      # уже стоит — правка идемпотентна
    found = conf.count(p["find"])
    if found != p["expect"]:
        sys.exit(f"{f.name}: кусок find встречается {found} раз, ожидалось {p['expect']} — правка НЕ применена")
    conf = conf.replace(p["find"], p["replace"], p["expect"])
    if p["done_marker"] not in conf:
        sys.exit(f"{f.name}: после замены нет done_marker")
    applied.append(f"{p['id']} — {p['why'][:80]}")

if conf.count("{") != conf.count("}"):
    sys.exit("после правок разъехались скобки — конфиг не записан")
if not applied:
    print("NONE")
else:
    pathlib.Path(out_path).write_text(conf)
    print("\n".join(applied))
PY
    ); then
        NGINX_RESULT="правка отклонена: $out"
        echo "nginx: $out" >&2
        rm -f "$tmp"
        return 0
    fi

    if [ "$out" = "NONE" ]; then
        rm -f "$tmp"
        return 0
    fi

    bak="$CONF.bak-$(date +%Y%m%d-%H%M%S)"
    cp -a "$CONF" "$bak"
    cat "$tmp" > "$CONF"
    rm -f "$tmp"
    NGINX_APPLIED=$out

    restore() {
        cp -a "$bak" "$CONF"
        nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
        NGINX_RESULT="откат ($1), копия $bak"
        echo "nginx: ОТКАТ — $1" >&2
    }

    if ! nginx -t >/dev/null 2>&1; then restore "nginx -t не прошёл"; return 0; fi
    if ! systemctl reload nginx; then restore "перезагрузка не удалась"; return 0; fi

    # Живые адреса после перезагрузки: главная обязана отдавать 200, а
    # несуществующая страница — именно 404. Так ловится правка, которая
    # синтаксически верна, но кладёт сайт.
    local code404 code200
    code200=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$HOST:443:127.0.0.1" "https://$HOST/" || echo 000)
    code404=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$HOST:443:127.0.0.1" "https://$HOST/net-takoy-stranicy-$RANDOM" || echo 000)
    if [ "$code200" != "200" ] || [ "$code404" != "404" ]; then
        restore "главная $code200, несуществующая $code404"
        return 0
    fi

    # Старые копии не копим: десяти хватает, чтобы отмотать назад.
    ls -1t "$CONF".bak-* 2>/dev/null | tail -n +11 | xargs -r rm -f
    NGINX_RESULT=применено
    echo "nginx: применено — $out"
}

apply_nginx

# Статус выкладки: что разложено и чем кончились правки. Лежит в веб-корне,
# чтобы это можно было прочитать снаружи, не заходя на сервер, — внутри
# только хеш коммита, время и результат.
python3 - "$WWW/deploy-status.json" "$HEAD" "$NGINX_RESULT" "$NGINX_APPLIED" <<'PY'
import json, pathlib, sys, datetime
path, head, result, applied = sys.argv[1:5]
pathlib.Path(path).write_text(json.dumps({
    "dist": head,
    "applied_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "nginx": {"result": result, "patches": [x for x in applied.split("\n") if x]},
}, ensure_ascii=False, indent=2) + "\n")
PY

echo "$(date -u +%FT%TZ) выложено $HEAD, nginx: $NGINX_RESULT"
