#!/usr/bin/env bash
# Разворачивает «Деловой Портрет» на чистом Ubuntu 24.04.
# Требует: код в текущем каталоге и файл /root/headshot.env с секретами.
# Идемпотентен: повторный запуск обновляет и перезапускает сервисы.
set -euo pipefail

APP=/opt/headshot-bot
SRC="$(cd "$(dirname "$0")/.." && pwd)"  # каталог headshot-bot из репозитория

echo "==> 1/8 Swap (2 ГБ)"
if ! swapon --show | grep -q /swapfile; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 2/8 Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip nginx ufw curl >/dev/null

echo "==> 3/8 Код в $APP"
mkdir -p "$APP"
# Копируем всё, кроме окружения и локальных данных.
rsync -a --delete \
    --exclude venv --exclude data --exclude __pycache__ \
    --exclude '*.pyc' --exclude .pytest_cache \
    "$SRC"/ "$APP"/

echo "==> 4/8 Секреты (.env)"
if [ ! -f /root/headshot.env ]; then
    echo "ОШИБКА: нет /root/headshot.env — создайте его перед запуском." >&2
    exit 1
fi
install -m 600 /root/headshot.env "$APP/.env"
# Прод-настройки поверх секретов (провайдер и режим оплаты).
grep -q '^PROVIDER='       "$APP/.env" || echo 'PROVIDER=fal'          >> "$APP/.env"
grep -q '^MANUAL_PAYMENT='  "$APP/.env" || echo 'MANUAL_PAYMENT=true'   >> "$APP/.env"
grep -q '^DATA_DIR='        "$APP/.env" || echo 'DATA_DIR=/opt/headshot-bot/data' >> "$APP/.env"
mkdir -p "$APP/data"

echo "==> 5/8 Python venv"
python3 -m venv "$APP/venv"
"$APP/venv/bin/pip" install -q --upgrade pip
"$APP/venv/bin/pip" install -q -r "$APP/requirements.txt"

echo "==> 6/8 systemd-сервисы"
cp "$APP/deploy/headshot-bot.service" /etc/systemd/system/
cp "$APP/deploy/headshot-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now headshot-bot headshot-web
systemctl restart headshot-bot headshot-web

echo "==> 7/8 nginx"
cp "$APP/deploy/nginx.conf" /etc/nginx/sites-available/headshot
ln -sf /etc/nginx/sites-available/headshot /etc/nginx/sites-enabled/headshot
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "==> 8/8 Файрвол"
ufw allow 22/tcp   >/dev/null 2>&1 || true
ufw allow 80/tcp   >/dev/null 2>&1 || true
ufw allow 443/tcp  >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo
echo "ГОТОВО. Проверка:"
sleep 3
systemctl is-active headshot-bot headshot-web nginx | tr '\n' ' '; echo
curl -sS -m 5 http://127.0.0.1:8000/health || true
echo
echo "Сайт: http://$(curl -sS -m 5 ifconfig.me || echo SERVER_IP)/"
