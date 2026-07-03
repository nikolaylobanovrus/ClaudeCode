-- Налог-сервис: база клиентов и статусов деклараций.
-- Вставьте весь файл в Supabase → SQL Editor → Run.

create table if not exists public.clients (
  id bigint primary key,
  email text not null default '',
  phone text not null default '',
  situation text not null default '',
  declaration_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Оператор (вошедший пользователь Supabase Auth) видит и редактирует всё.
drop policy if exists "operator select" on public.clients;
create policy "operator select" on public.clients
  for select to authenticated using (true);

drop policy if exists "operator update" on public.clients;
create policy "operator update" on public.clients
  for update to authenticated using (true) with check (true);

-- Клиентские функции: сайт вызывает их анонимно, прямого доступа
-- к таблице у роли anon нет (персональные данные не читаются).

create or replace function public.register_client(p_id bigint, p_email text, p_phone text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.clients (id, email, phone)
  values (p_id, coalesce(p_email, ''), coalesce(p_phone, ''))
  on conflict (id) do nothing;
$$;

create or replace function public.set_situation(p_id bigint, p_situation text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clients
  set situation = coalesce(p_situation, '')
  where id = p_id;
$$;

create or replace function public.get_status(p_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select declaration_sent from public.clients where id = p_id;
$$;

revoke all on function public.register_client(bigint, text, text) from public;
revoke all on function public.set_situation(bigint, text) from public;
revoke all on function public.get_status(bigint) from public;

grant execute on function public.register_client(bigint, text, text) to anon, authenticated;
grant execute on function public.set_situation(bigint, text) to anon, authenticated;
grant execute on function public.get_status(bigint) to anon, authenticated;
