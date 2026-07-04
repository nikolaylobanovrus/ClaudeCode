-- Миграция: заказы услуги «Заполнить декларацию самому».
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно (все операции idempotent).
--
-- Схема доступа:
--   - роль anon НЕ имеет прямого доступа к таблице — только три RPC ниже;
--   - создание заказа фиксирует цену НА СЕРВЕРЕ (клиент сумму не диктует);
--   - mock_pay_order работает только для тестовых (mock) заказов —
--     при включении боевой ЮKassa выполните REVOKE из docs/yookassa-setup.md.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id bigint,                       -- ID клиента из кабинета (если есть)
  amount integer not null,                -- цена в рублях на момент заказа
  status text not null default 'pending', -- pending | waiting | paid | canceled
  provider text not null default 'mock',  -- mock | yookassa
  provider_payment_id text,               -- id платежа в ЮKassa
  confirmation_url text,                  -- страница оплаты ЮKassa
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.orders enable row level security;

-- Оператор (authenticated) видит заказы в своём кабинете.
drop policy if exists "operator select orders" on public.orders;
create policy "operator select orders"
  on public.orders for select to authenticated using (true);

-- Цена услуги. Единственное место, где она задана для базы:
-- при изменении цены на сайте (src/data/content.js) поменяйте и здесь.
create or replace function public.self_service_price()
returns integer language sql immutable as $$ select 99 $$;

-- Создать тестовый (mock) заказ. Возвращает id.
create or replace function public.create_order(p_client bigint default null)
returns uuid
language sql security definer set search_path = public as $$
  insert into orders (client_id, amount, provider)
  values (p_client, self_service_price(), 'mock')
  returning id;
$$;

-- Статус заказа для поллинга с сайта. Наружу — только статус и сумма.
create or replace function public.get_order_status(p_id uuid)
returns json
language sql security definer set search_path = public as $$
  select json_build_object('status', status, 'amount', amount, 'provider', provider)
  from orders where id = p_id;
$$;

-- Тестовая «оплата»: помечает оплаченным ТОЛЬКО mock-заказ.
-- В боевом режиме оплату подтверждает вебхук ЮKassa (Edge Function),
-- а эту функцию нужно отозвать: см. docs/yookassa-setup.md.
create or replace function public.mock_pay_order(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  update orders
     set status = 'paid', paid_at = now()
   where id = p_id and provider = 'mock' and status <> 'paid';
$$;

grant execute on function public.create_order(bigint) to anon;
grant execute on function public.get_order_status(uuid) to anon;
grant execute on function public.mock_pay_order(uuid) to anon;
