-- Миграция: флаги функций (киллсвитч для распознавания документов).
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- Флаг doc_autofill управляет блоком «Заполнить из документов» в мастере:
--   ВЫКЛЮЧИТЬ фичу мгновенно (без деплоя сайта):
--     update feature_flags set enabled = false where key = 'doc_autofill';
--   или Supabase → Table Editor → feature_flags → снять галочку enabled.
--
-- Клиент (DocAutofill) при выключенном флаге не показывает блок вообще;
-- edge function parse-documents дополнительно проверяет флаг на сервере.

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into feature_flags (key, enabled)
values ('doc_autofill', true)
on conflict (key) do nothing;

-- Флаг address_lookup управляет полем «Адрес прописки» (автоопределение
-- ИФНС/ОКТМО через DaData, см. docs/dadata-setup.md).
insert into feature_flags (key, enabled)
values ('address_lookup', true)
on conflict (key) do nothing;

-- Прямой доступ к таблице закрыт; чтение — только через RPC.
alter table feature_flags enable row level security;

create or replace function public.feature_enabled(p_key text)
returns boolean
language sql security definer set search_path = public as $$
  select coalesce(
    (select enabled from feature_flags where key = p_key),
    false
  );
$$;

grant execute on function public.feature_enabled(text) to anon;
grant execute on function public.feature_enabled(text) to authenticated;
