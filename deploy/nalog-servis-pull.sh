#!/usr/bin/env bash
# Серверная часть выкладки налог-сервис.рф: тянем собранный сайт из git.
#
# Почему так, а не rsync по SSH: среда, из которой ведётся разработка,
# ходит наружу только по HTTPS — SSH оттуда недоступен. Поэтому инициатива
# у сервера: он периодически забирает ветку с готовой сборкой. Та же схема,
# что у соседнего проекта (headshot-bot/deploy/self_deploy.sh).
#
# Ставится один раз, дальше работает по таймеру systemd.
set -euo pipefail

REPO=https://github.com/nikolaylobanovrus/ClaudeCode.git
BRANCH="${DEPLOY_BRANCH:-deploy/nalog-servis-dist}"
SRC=/root/nalog-servis-dist
WWW=/var/www/nalog-servis

mkdir -p "$WWW"
if [ ! -d "$SRC/.git" ]; then
    rm -rf "$SRC"
    git clone -q --depth 1 -b "$BRANCH" "$REPO" "$SRC"
else
    git -C "$SRC" fetch -q --depth 1 origin "$BRANCH"
    git -C "$SRC" reset -q --hard "origin/$BRANCH"
fi

HEAD=$(git -C "$SRC" rev-parse --short HEAD)
# --delete убирает ассеты прошлых сборок (у них хеш в имени, иначе копятся).
# .git исключаем, чтобы история не уехала в веб-корень.
rsync -a --delete --exclude .git "$SRC"/ "$WWW"/
echo "$(date -u +%FT%TZ) выложено $HEAD"
