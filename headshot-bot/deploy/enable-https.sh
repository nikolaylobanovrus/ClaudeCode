#!/usr/bin/env bash
# Выпускает бесплатный HTTPS (Let's Encrypt) для домена и включает редирект.
# Запуск: bash enable-https.sh d-portret.ru [email-для-уведомлений]
# Требует, чтобы домен уже резолвился на этот сервер.
set -euo pipefail

DOMAIN="${1:?Укажите домен: bash enable-https.sh d-portret.ru}"
EMAIL="${2:-nikolay.lobanov.rus@gmail.com}"

echo "==> certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq certbot python3-certbot-nginx >/dev/null

echo "==> server_name в конфиге nginx"
sed -i "s/server_name .*/server_name ${DOMAIN} www.${DOMAIN};/" /etc/nginx/sites-available/headshot
nginx -t
systemctl reload nginx

echo "==> Выпуск сертификата и редирект на HTTPS"
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL}" --redirect

systemctl reload nginx
echo
echo "ГОТОВО. Проверка:"
sleep 2
curl -sS -m 8 "https://${DOMAIN}/health" || echo "(сертификат мог ещё не подхватиться — подождите минуту)"
echo
echo "Открой: https://${DOMAIN}/"
