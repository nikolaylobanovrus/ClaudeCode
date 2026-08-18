#!/usr/bin/env bash
# Выкладка собранного сайта на VPS по SSH.
#
#   VITE_HASH_ROUTER=1 npm run build && ./scripts/deploy-vps.sh
#
# Параметры берутся из /root/.ndfl-tokens (вне репозитория):
#   VPS_HOST=...        ip или домен сервера
#   VPS_USER=root       пользователь ssh
#   VPS_PATH=/var/www/nalog-servis
# Ключ — /root/.ssh/ndfl_deploy (публичная часть кладётся на сервер).
set -euo pipefail

TOKENS=/root/.ndfl-tokens
KEY=/root/.ssh/ndfl_deploy
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

val() { grep -oP "(?<=^$1=).*" "$TOKENS" 2>/dev/null | tail -1; }
HOST=$(val VPS_HOST); USER=$(val VPS_USER); DEST=$(val VPS_PATH)
: "${HOST:?нет VPS_HOST в $TOKENS}"
USER=${USER:-root}
DEST=${DEST:-/var/www/nalog-servis}

[ -d "$ROOT/dist" ] || { echo "нет dist/ — сначала VITE_HASH_ROUTER=1 npm run build"; exit 1; }

# --delete убирает старые ассеты с чужими хешами, чтобы каталог не пух.
# Сначала заливаем assets/, потом index.html: иначе на секунду возможен
# index, ссылающийся на ещё не загруженные чанки.
rsync -az --delete --exclude=index.html \
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  "$ROOT/dist/" "$USER@$HOST:$DEST/"
rsync -az -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  "$ROOT/dist/index.html" "$USER@$HOST:$DEST/index.html"

echo "выложено на $HOST:$DEST"
