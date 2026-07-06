-- Миграция: режим оператора в мастере «Заполнить самому».
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- Оператор (вошедший на /operator, роль authenticated) может создавать
-- декларации в мастере БЕЗ оплаты: функция создаёт заказ сразу со статусом
-- paid и amount = 0. Проверка оплаты на шаге «Документы» (get_order_status)
-- проходит честно — заказ реально оплачен в базе.
--
-- Безопасность: функция доступна ТОЛЬКО роли authenticated (оператору).
-- Роли anon и public доступ отозван — обычный посетитель сайта вызвать
-- её не может.

create or replace function public.operator_paid_order()
returns uuid
language sql security definer set search_path = public as $$
  insert into orders (amount, provider, status, paid_at)
  values (0, 'operator', 'paid', now())
  returning id;
$$;

revoke execute on function public.operator_paid_order() from public;
revoke execute on function public.operator_paid_order() from anon;
grant execute on function public.operator_paid_order() to authenticated;
