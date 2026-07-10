-- Миграция: резервный канал заявок (когда почтовый сервис недоступен).
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- Сайт отправляет заявки письмом через FormSubmit. Если почтовый сервис
-- лежит (как 522 у formsubmit.co), заявка сохраняется сюда — клиент видит
-- обычный «успех», ничего не теряется. Оператор видит невзятые заявки
-- в своём кабинете (/operator, блок «Заявки с сайта») и отмечает их
-- обработанными.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,            -- тема заявки (как _subject письма)
  payload jsonb not null,        -- поля формы как есть
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Оператор (authenticated) читает и отмечает обработанные.
drop policy if exists "operator select leads" on public.leads;
create policy "operator select leads"
  on public.leads for select to authenticated using (true);
drop policy if exists "operator update leads" on public.leads;
create policy "operator update leads"
  on public.leads for update to authenticated using (true);

-- Приём заявки с сайта (роль anon — прямого доступа к таблице нет).
create or replace function public.submit_lead(p_kind text, p_payload jsonb)
returns uuid
language sql security definer set search_path = public as $$
  insert into leads (kind, payload) values (p_kind, p_payload)
  returning id;
$$;

grant execute on function public.submit_lead(text, jsonb) to anon;
