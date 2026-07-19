#!/usr/bin/env bash
# Один-в-один разворачивание на чистом сервере. Секреты берёт из
# /root/headshot.env (создайте его до запуска). Публичный репозиторий —
# токен не нужен.
set -euo pipefail

BRANCH=claude/us-services-russia-gap-5hfawx
REPO=https://github.com/nikolaylobanovrus/ClaudeCode.git

apt-get update -qq
apt-get install -y -qq git rsync >/dev/null

rm -rf /root/src
git clone -q -b "$BRANCH" "$REPO" /root/src
bash /root/src/headshot-bot/deploy/deploy.sh
