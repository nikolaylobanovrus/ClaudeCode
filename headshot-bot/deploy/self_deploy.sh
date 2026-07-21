#!/usr/bin/env bash
# Самодеплой по HTTPS-хуку управления. Запускается в ОТДЕЛЬНОМ systemd-юните
# (systemd-run), поэтому перезапуск headshot-web в конце deploy.sh не обрывает
# сам процесс деплоя. Весь вывод — в /root/deploy.log.
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-claude/us-services-russia-gap-5hfawx}"
SRC="${DEPLOY_SRC_DIR:-/root/src}"
LOG=/root/deploy.log

exec >>"$LOG" 2>&1
echo
echo "================ deploy $(date -u +%FT%TZ) branch=$BRANCH ================"

cd "$SRC"
git fetch --quiet origin "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "-> HEAD $(git rev-parse --short HEAD): $(git log -1 --pretty=%s)"

bash "$SRC/headshot-bot/deploy/deploy.sh"
echo "================ done $(date -u +%FT%TZ) ================"
