-- Миграция: доступ оператора — только настоящим операторам, а не любому,
-- кто завёл учётную запись в проекте Supabase.
--
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- ЧТО БЫЛО НЕ ТАК (обнаружено 28.09.2026)
--
-- Все операторские права были выданы роли `authenticated` с условием
-- `using (true)`, то есть ЛЮБОМУ вошедшему пользователю проекта:
--
--   public.clients        select / update / delete   — карточки клиентов
--   public.leads          select / update            — заявки: ФИО, телефон, почта
--   public.orders         select                     — все заказы и оплаты
--   storage.objects       select / delete            — загруженные документы
--                                                      (паспорта, справки о доходах)
--   public.operator_paid_order()                     — заказ со статусом «оплачен»
--                                                      за 0 ₽
--
-- При этом в настройках проекта была включена открытая регистрация
-- (disable_signup = false, email-провайдер включён). Адрес проекта и anon-ключ
-- лежат в клиентском коде по дизайну — значит зарегистрироваться через
-- /auth/v1/signup мог кто угодно, подтвердить почту в своём же ящике и
-- получить всё перечисленное. Это и персональные данные клиентов
-- (152-ФЗ), и бесплатные декларации в обход оплаты.
--
-- Само приложение через signup НИКОГО не регистрирует: клиентский кабинет
-- живёт в localStorage (src/lib/account.js), а операторов заводят руками в
-- панели Supabase (docs/supabase-setup.md, шаг 3). То есть открытая
-- регистрация не использовалась вообще.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ
--
-- Заводит явный список операторов и переписывает все политики и функцию с
-- «любой вошедший» на «есть в списке операторов».
--
-- ОТКРЫТАЯ РЕГИСТРАЦИЯ УЖЕ ВЫКЛЮЧЕНА (28.09.2026, по решению владельца):
-- disable_signup = true, проверено запросом к /auth/v1/signup — отвечает
-- 422 signup_disabled. Это первая, немедленная мера; операторов по-прежнему
-- заводят руками в панели (Authentication → Users → Add user), на вход
-- существующих операторов настройка не влияет.
--
-- Настройка живёт в проекте, а не в этой миграции. Если её когда-нибудь
-- включат обратно, дверь откроется снова — поэтому политики ниже всё равно
-- нужны: они закрывают доступ по существу, а не по факту «регистрация
-- отключена».

-- --- 1. Список операторов ----------------------------------------------------
create table if not exists public.operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  added_at timestamptz not null default now()
);

-- Таблицу не должен читать никто, кроме security definer-функции ниже.
alter table public.operators enable row level security;
revoke all on table public.operators from anon, authenticated;

-- ВАЖНО: впишите сюда свою операторскую учётную запись, иначе после миграции
-- кабинет /operator перестанет что-либо показывать. Адрес — тот, под которым
-- вы входите в кабинет оператора.
insert into public.operators (user_id, email)
select id, email from auth.users where email = 'ВПИШИТЕ_ПОЧТУ_ОПЕРАТОРА'
on conflict (user_id) do nothing;

-- --- 2. Признак «я оператор» --------------------------------------------------
-- security definer: сама таблица закрыта, проверку делает функция.
create or replace function public.is_operator()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operators where user_id = auth.uid());
$$;

revoke all on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

-- --- 3. Политики: «любой вошедший» → «оператор» --------------------------------
drop policy if exists "operator select" on public.clients;
create policy "operator select" on public.clients
  for select to authenticated using (public.is_operator());

drop policy if exists "operator update" on public.clients;
create policy "operator update" on public.clients
  for update to authenticated using (public.is_operator()) with check (public.is_operator());

drop policy if exists "operator delete clients" on public.clients;
create policy "operator delete clients" on public.clients
  for delete to authenticated using (public.is_operator());

drop policy if exists "operator select leads" on public.leads;
create policy "operator select leads" on public.leads
  for select to authenticated using (public.is_operator());

drop policy if exists "operator update leads" on public.leads;
create policy "operator update leads" on public.leads
  for update to authenticated using (public.is_operator());

drop policy if exists "operator select orders" on public.orders;
create policy "operator select orders" on public.orders
  for select to authenticated using (public.is_operator());

drop policy if exists "operator read client docs" on storage.objects;
create policy "operator read client docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-docs' and public.is_operator());

drop policy if exists "operator delete client docs" on storage.objects;
create policy "operator delete client docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-docs' and public.is_operator());

-- --- 4. Заказ без оплаты — только оператору ------------------------------------
-- Была security definer-функция без единой проверки: достаточно любого
-- токена роли authenticated, чтобы получить оплаченный заказ за 0 ₽.
create or replace function public.operator_paid_order()
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_operator() then
    raise exception 'operator_paid_order: доступно только оператору'
      using errcode = '42501';
  end if;
  insert into orders (amount, provider, status, paid_at)
  values (0, 'operator', 'paid', now())
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.operator_paid_order() from public, anon;
grant execute on function public.operator_paid_order() to authenticated;

-- --- 5. Проверка --------------------------------------------------------------
-- Должна вернуть одну строку — вашу операторскую учётную запись.
-- select o.email, o.added_at from public.operators o;
