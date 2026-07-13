# Адрес прописки → ИФНС и ОКТМО (DaData): настройка

Поле «Адрес прописки» на шаге «О вас»: пользователь начинает вводить адрес,
выбирает подсказку — коды ИФНС и ОКТМО подставляются сами. Подсказки и
реквизиты даёт API DaData (бесплатно до 10 000 запросов/день); адрес в
декларацию не попадает и нигде не сохраняется.

## 1. Ключ DaData

1. Зарегистрироваться на dadata.ru (бесплатно).
2. Личный кабинет → «API-ключи» → скопировать **API-ключ** (token).

## 2. Секрет Supabase

Supabase → Project → Edge Functions → Secrets:

| Секрет | Значение |
|---|---|
| `DADATA_TOKEN` | API-ключ из шага 1 |

## 3. Флаг

SQL Editor → выполнить (уже включён в docs/supabase-migration-feature-flags.sql):

```sql
insert into feature_flags (key, enabled)
values ('address_lookup', true)
on conflict (key) do nothing;
```

## 4. Деплой функции

Как parse-documents: Dashboard → Edge Functions → Deploy a new function →
Via Editor → имя `suggest-address` → вставить код из
`supabase/functions/suggest-address/index.ts` → Deploy.
(Или CLI: `supabase functions deploy suggest-address`.)

## 5. Проверка

```sh
curl -sS -X POST "https://<PROJECT>.supabase.co/functions/v1/suggest-address" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"query":"москва тверская 7"}'
# ожидаемо: {"suggestions":[{"value":"г Москва, ул Тверская, д 7","oktmo":"453740000","taxOffice":"7710"}, ...]}
```

## Киллсвитч

```sql
update feature_flags set enabled = false where key = 'address_lookup';
```

Поле адреса исчезает из анкеты, ИФНС/ОКТМО вводятся вручную, как раньше.

## Метрика

Цель `address_lookup` (JavaScript-событие) — срабатывает при успешном
определении реквизитов по адресу.
