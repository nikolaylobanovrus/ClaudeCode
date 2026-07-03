-- Миграция: тариф и сумма, назначаемые оператором.
-- Вставьте в Supabase → SQL Editor → Run (для уже созданной базы).

alter table public.clients add column if not exists tariff text not null default '';
alter table public.clients add column if not exists amount integer not null default 0;

-- Клиент запрашивает свою сумму к оплате по числовому ID (без ПДн).
create or replace function public.get_payment(p_id bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'tariff', tariff,
    'amount', amount,
    'declaration_sent', declaration_sent
  )
  from public.clients where id = p_id;
$$;

revoke all on function public.get_payment(bigint) from public;
grant execute on function public.get_payment(bigint) to anon, authenticated;
