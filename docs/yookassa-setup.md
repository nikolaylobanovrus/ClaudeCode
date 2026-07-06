# Подключение оплаты ЮKassa для «Заполнить самому»

Сейчас оплата в мастере работает в **тестовом режиме** (заглушка): кнопка
«Оплатить» имитирует успешный платёж, деньги не списываются, на странице
показана жёлтая плашка «Тестовый режим». Код для боевой оплаты уже написан —
его нужно только включить по шагам ниже.

Схема боевого режима: сайт остаётся статическим, свой сервер не нужен.
Секретные ключи ЮKassa живут в двух Supabase Edge Functions:

- `create-payment` — создаёт платёж и возвращает ссылку на страницу оплаты;
- `yookassa-webhook` — принимает подтверждение от ЮKassa, перепроверяет
  платёж по API и помечает заказ оплаченным. Документы у клиента открываются
  автоматически, без действий оператора.

## Шаг 0. Что нужно заранее

1. Договор с ЮKassa (нужно юрлицо/ИП): https://yookassa.ru → «Подключить».
2. В личном кабинете ЮKassa получить **shopId** и **секретный ключ**.
3. Применённая миграция заказов: `docs/supabase-migration-orders.sql`
   (SQL Editor → Run).
4. Установленный Supabase CLI: https://supabase.com/docs/guides/cli

## Шаг 1. Задеплоить Edge Functions

В корне репозитория:

```bash
supabase login
supabase link --project-ref <ref-вашего-проекта>   # ref виден в URL проекта

supabase secrets set \
  YOOKASSA_SHOP_ID=<shopId> \
  YOOKASSA_SECRET_KEY=<секретный_ключ> \
  SITE_URL=https://nikolaylobanovrus.github.io/ClaudeCode

supabase functions deploy create-payment
supabase functions deploy yookassa-webhook --no-verify-jwt
```

`--no-verify-jwt` обязателен для вебхука: ЮKassa не умеет передавать наш JWT.
Это безопасно — вебхук не доверяет телу запроса и перепроверяет каждый платёж
прямым запросом к API ЮKassa.

## Шаг 2. Указать вебхук в ЮKassa

Личный кабинет ЮKassa → Интеграция → HTTP-уведомления:

- URL: `https://<ref>.supabase.co/functions/v1/yookassa-webhook`
- События: `payment.succeeded`, `payment.canceled`.

## Шаг 3. Включить провайдера на сайте

В файле `.github/workflows/deploy-pages.yml` в блок `env:` шага сборки добавить:

```yaml
VITE_PAY_PROVIDER: "yookassa"
```

(локально — `VITE_PAY_PROVIDER=yookassa npm run build`). Пересобрать и
задеплоить сайт.

## Шаг 4. ОБЯЗАТЕЛЬНО: отключить тестовую оплату

Пока действует тестовый режим, у роли anon есть RPC `mock_pay_order`
(она помечает оплаченными только mock-заказы, боевые тронуть не может,
но после запуска её лучше убрать совсем). SQL Editor:

```sql
revoke execute on function public.mock_pay_order(uuid) from anon;
```

## Чек 54-ФЗ

Магазины с включённой фискализацией обязаны передавать чек в каждом
платеже — create-payment формирует его автоматически: контакт клиента
(телефон из анкеты, поэтому он обязателен, или email аккаунта) и одна
позиция «услуга», ставка НДС — код 1 («без НДС», УСН). Если система
налогообложения изменится, поменяйте vat_code в create-payment/index.ts.

## Шаг 5. Проверка

1. Откройте сайт → «Заполнить самому» → пройдите анкету до оплаты.
2. Плашки «Тестовый режим» быть не должно; кнопка ведёт на страницу ЮKassa.
3. Оплатите тестовой картой ЮKassa (`5555 5555 5555 4444`, любые CVC/срок —
   если магазин в тестовом режиме ЮKassa).
4. После оплаты вернётесь на сайт — в течение нескольких секунд откроется
   шаг «Документы».
5. В Supabase → Table Editor → orders у заказа `status = paid`.

## Как поменять цену услуги

Цена задана в двух местах (специально, чтобы клиент не мог диктовать сумму):

1. `src/data/content.js` → `selfService.price` (показывается на сайте);
2. функция `self_service_price()` в базе (используется при создании платежа):

```sql
create or replace function public.self_service_price()
returns integer language sql immutable as $$ select 99 $$;
```
