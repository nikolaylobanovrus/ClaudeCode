#!/usr/bin/env bash
# Сборка и публикация сайта в ветку-артефакт, откуда его забирает VPS.
#
#   ./scripts/publish-dist.sh
#
# Скрипт собирает САМ, с боевыми переменными окружения. Так сделано не для
# удобства: 18.08.2026 сборка публиковалась вручную командой
# `VITE_HASH_ROUTER=1 npm run build`, без VITE_PAY_PROVIDER — и на боевом
# сайте оплата уехала в тестовый режим (PROVIDER по умолчанию «mock»,
# см. src/lib/payments.js). До переезда эти переменные задавал workflow
# GitHub Pages, и забыть их было невозможно. Теперь они здесь.
#
# Ветка deploy/nalog-servis-dist содержит ТОЛЬКО содержимое dist/ — никакого
# исходного кода и никакой истории: сервер клонирует её с --depth 1 и
# раскладывает в веб-корень (см. deploy/nalog-servis-pull.sh). Ветка
# перезаписывается на каждой публикации, история сборок в ней не нужна.
set -euo pipefail

BRANCH=deploy/nalog-servis-dist
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
echo "==> сборка (боевая конфигурация)"
VITE_HASH_ROUTER=1 VITE_PAY_PROVIDER=yookassa npm run build

# Страховка от повторения инцидента: боевая сборка обязана уметь ходить
# в create-payment. Если её там нет — публиковать нечего.
if ! grep -rq "create-payment" "$ROOT/dist/assets"; then
    echo "ОШИБКА: в сборке нет вызова create-payment — оплата собралась в тестовом режиме" >&2
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
echo "==> опубликовано в $BRANCH (сборка из $SRC_HEAD)"
