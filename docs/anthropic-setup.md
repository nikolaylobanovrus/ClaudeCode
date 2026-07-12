# Распознавание документов (Claude API): настройка

Фича «Заполнить из документов» в мастере: клиент загружает фото/PDF
(справка о доходах, паспорт, договоры…), Edge Function `parse-documents`
отправляет их в Anthropic Messages API и возвращает поля анкеты.
Файлы нигде не сохраняются (живут в памяти функции секунды).

## 1. Ключ Anthropic

1. console.anthropic.com → API Keys → Create Key (аккаунт уже создан,
   баланс пополнен).
2. Скопировать ключ `sk-ant-…` — показывается один раз.

## 2. Секреты Supabase

Supabase → Project → Edge Functions → Secrets (или `supabase secrets set`):

| Секрет | Значение |
|---|---|
| `ANTHROPIC_API_KEY` | ключ из шага 1 |
| `ANTHROPIC_MODEL` | (необязательно) id модели; по умолчанию `claude-opus-4-8` |

Смена модели = смена секрета, передеплой не нужен (применится на следующем
вызове).

## 3. Миграция флагов

Supabase → SQL Editor → выполнить целиком
`docs/supabase-migration-feature-flags.sql` (таблица `feature_flags`,
RPC `feature_enabled`, флаг `doc_autofill = true`).

## 4. Деплой функции

```sh
supabase functions deploy parse-documents
```

(как деплоились `create-payment`/`yookassa-webhook`; JWT-проверка по
умолчанию — фронт шлёт anon-ключ в Authorization, это ок).

## 5. Проверка

```sh
curl -sS -X POST "https://<PROJECT>.supabase.co/functions/v1/parse-documents" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"files":[],"year":2025,"types":[]}'
# ожидаемо: {"error":"нет файлов"} — функция жива и флаг включён
```

Полный тест — через сайт: анкета → «Заполнить из документов» → приложить
справку о доходах → поля заполнились.

## Киллсвитч (отключить фичу мгновенно, без деплоя)

```sql
update feature_flags set enabled = false where key = 'doc_autofill';
```

или Table Editor → `feature_flags` → снять галочку `enabled`.
Блок исчезает из мастера сразу (клиент проверяет флаг при каждом открытии
анкеты); включение обратно — той же галочкой.

## Себестоимость

Opus 4.8: комплект из 3–5 фото ≈ $0.03–0.06 (3–5 ₽). $5 баланса ≈ 100–150
анкет. Кончился баланс → функция вернёт понятную ошибку, анкета продолжит
работать вручную (fail-closed).
