-- Миграция: номер заказа перестаёт быть пропуском на неограниченное число
-- деклараций. Применение: Supabase → SQL Editor → New query → вставить
-- целиком → Run. Безопасно выполнять повторно.
--
-- Зачем. Восстановление доступа по номеру заказа (шаг «Документы», кнопка
-- «Оплатили, а документы не открылись?») привязывало ЛЮБОЙ оплаченный номер
-- к ЛЮБОЙ анкете. Номер заказа виден в адресной строке, его легко переслать
-- — и один платёж в 199 ₽ открывал документы всем, кому его показали, сколько
-- угодно раз.
--
-- Как теперь. Заказ запоминает, к какой анкете его привязали (хеш анкеты,
-- не сами данные — персональных данных функция не видит). Та же анкета
-- открывается сколько угодно. Другая анкета — тоже можно, но не больше
-- MAX_CLAIMS раз: человек, потерявший черновик и набравший данные заново,
-- получит другой хеш, и отказать ему нельзя. Массовую раздачу это закрывает,
-- честного плательщика — нет.

alter table public.orders add column if not exists claim_hash text;
alter table public.orders add column if not exists claim_count integer not null default 0;

create or replace function public.claim_order(p_id uuid, p_hash text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  max_claims constant integer := 3;
begin
  select * into o from public.orders where id = p_id;
  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  if o.status <> 'paid' then
    return json_build_object('ok', false, 'reason', 'not_paid');
  end if;

  -- Та же анкета (или первое обращение) — открываем без вопросов.
  if o.claim_hash is null then
    update public.orders set claim_hash = p_hash, claim_count = 1 where id = p_id;
    return json_build_object('ok', true, 'amount', o.amount);
  end if;
  if o.claim_hash = p_hash then
    return json_build_object('ok', true, 'amount', o.amount);
  end if;

  -- Другая анкета: разрешаем, пока смен немного.
  if o.claim_count >= max_claims then
    return json_build_object('ok', false, 'reason', 'exhausted');
  end if;
  update public.orders
     set claim_hash = p_hash, claim_count = claim_count + 1
   where id = p_id;
  return json_build_object('ok', true, 'amount', o.amount);
end;
$$;

grant execute on function public.claim_order(uuid, text) to anon;
