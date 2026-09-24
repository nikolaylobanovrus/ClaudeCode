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

# Списки страниц в App.jsx и src/data/routes.js обязаны совпадать: по второму
# строится пререндер и карта сайта, и забытый там маршрут станет для человека
# страницей «не найдено».
echo "==> сверка списка страниц"
node scripts/check-routes.mjs

echo "==> сборка (боевая конфигурация)"
# БЕЗ VITE_HASH_ROUTER: с 24.09.2026 боевой сайт живёт на чистых URL, хеш
# остаётся только на резервной площадке GitHub Pages (deploy-pages.yml), где
# нет серверного SPA-фолбэка. Старые «#/»-ссылки разбирает шим, встроенный
# первым тегом в <head> (scripts/hash-url-shim.js).
VITE_PAY_PROVIDER=yookassa npm run build

echo "==> пререндер страниц"
node scripts/prerender.mjs
node scripts/check-prerender.mjs

echo "==> старые ссылки с решёткой"
node scripts/check-shim.mjs

# Страховка от повторения инцидента: боевая сборка обязана уметь ходить
# в create-payment. Если её там нет — публиковать нечего.
if ! grep -rq "create-payment" "$ROOT/dist/assets"; then
    echo "ОШИБКА: в сборке нет вызова create-payment — оплата собралась в тестовом режиме" >&2
    exit 1
fi

# Три признака того, что уезжает именно то, что задумано.
if ! grep -q "<h1" "$ROOT/dist/index.html"; then
    echo "ОШИБКА: в главной нет <h1> — пререндер не отработал, краулер увидит пустую страницу" >&2
    exit 1
fi
if ! grep -q "location.hash.indexOf" "$ROOT/dist/index.html"; then
    echo "ОШИБКА: в сборке нет шима старых ссылок — 109 объявлений Директа уедут в никуда" >&2
    exit 1
fi
test -s "$ROOT/dist/sitemap.xml" || { echo "ОШИБКА: пустой sitemap.xml" >&2; exit 1; }
test -s "$ROOT/dist/404.html"   || { echo "ОШИБКА: нет dist/404.html" >&2; exit 1; }

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
