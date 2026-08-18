#!/usr/bin/env bash
# Публикация собранного сайта в отдельную ветку, откуда его забирает сервер.
#
#   VITE_HASH_ROUTER=1 npm run build && ./scripts/publish-dist.sh
#
# Ветка deploy/nalog-servis-dist содержит ТОЛЬКО содержимое dist/ — никакого
# исходного кода и никакой истории: сервер клонирует её с --depth 1 и
# раскладывает в веб-корень (см. deploy/nalog-servis-pull.sh).
#
# Ветка перезаписывается на каждой публикации — это ветка-артефакт, история
# сборок в ней не нужна и никем не читается.
set -euo pipefail

BRANCH=deploy/nalog-servis-dist
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ ! -d "$ROOT/dist" ]; then
    echo "нет dist/ — сначала VITE_HASH_ROUTER=1 npm run build" >&2
    exit 1
fi

SRC_HEAD=$(git -C "$ROOT" rev-parse --short HEAD)
REMOTE=$(git -C "$ROOT" remote get-url origin)
cp -r "$ROOT/dist/." "$WORK/"

cd "$WORK"
git init -q
git config user.email "noreply@anthropic.com"
git config user.name "deploy"
git add -A
git commit -q -m "сборка сайта из $SRC_HEAD"
git push -q -f "$REMOTE" "HEAD:$BRANCH"
echo "опубликовано в $BRANCH (сборка из $SRC_HEAD)"
