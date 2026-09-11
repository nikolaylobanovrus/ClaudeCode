// Edge Function: вебхук ЮKassa (payment.succeeded / payment.canceled).
// Телу запроса НЕ доверяем: берём только id платежа и перепроверяем его
// статус прямым запросом к API ЮKassa со своими ключами — подделать
// подтверждение оплаты снаружи нельзя.
// Деплой с --no-verify-jwt (ЮKassa не шлёт наш JWT): docs/yookassa-setup.md.
import { createClient } from "npm:@supabase/supabase-js@2";

const SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID") ?? "";
const SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  // ok() — «событие обработано или нас не касается, повторять не нужно».
  // retry() — «мы не смогли обработать, повторите»: ЮKassa ретраит на любой
  // не-2xx ответ. Разница принципиальная. Раньше 200 возвращался на КАЖДОМ
  // пути отказа, в том числе когда API ЮKassa не ответило на перепроверку
  // платежа. Один такой сбой означал, что заказ навсегда останется в статусе
  // «ожидает»: деньги у человека списаны, документы не выданы, и
  // восстановление по номеру заказа тоже скажет «оплата не подтверждена».
  const ok = () => new Response("ok", { status: 200 });
  const retry = (why: string) => {
    console.error("вебхук не обработан, просим повтор:", why);
    return new Response(why, { status: 500 });
  };
  if (req.method !== "POST") return ok();

  let paymentId = "";
  try {
    const event = await req.json();
    paymentId = event?.object?.id ?? "";
  } catch {
    return ok();
  }
  if (!paymentId) return ok();

  // Перепроверка платежа у ЮKassa (единственный источник правды).
  let res: Response;
  try {
    res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: "Basic " + btoa(`${SHOP_ID}:${SECRET_KEY}`) },
    });
  } catch (e) {
    return retry(`API ЮKassa недоступно: ${e}`);
  }
  // 404 — такого платежа у нас нет, повторять бессмысленно. Всё остальное
  // (5xx, 401, таймаут) — временное, просим повтор.
  if (res.status === 404) return ok();
  if (!res.ok) return retry(`API ЮKassa ответило ${res.status}`);
  const payment = await res.json();

  const orderId = payment?.metadata?.orderId;
  if (!orderId) return ok();

  const { data: order, error: readErr } = await supabase
    .from("orders")
    .select("id, amount, provider_payment_id, status")
    .eq("id", orderId)
    .single();
  if (readErr) return retry(`база не ответила: ${readErr.message}`);
  if (!order) return ok(); // заказа нет — не наш платёж
  // Гонка: create-payment дописывает provider_payment_id ТРЕТЬИМ шагом, уже
  // после создания платежа в ЮKassa. Вебхук может прийти раньше — тогда поле
  // ещё пустое, и молча отбросить событие значит потерять оплату навсегда.
  // Пустое — просим повтор; чужой непустой id — это правда не наш платёж.
  if (!order.provider_payment_id) return retry("provider_payment_id ещё не записан");
  if (order.provider_payment_id !== paymentId) return ok();

  if (payment.status === "succeeded") {
    // Сумма платежа обязана совпадать с суммой заказа.
    const paidAmount = Math.round(Number(payment.amount?.value ?? 0));
    if (paidAmount >= order.amount && order.status !== "paid") {
      const { error } = await supabase
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderId);
      // Не записали оплату — обязаны попросить повтор: иначе человек заплатил,
      // а в базе этого нет.
      if (error) return retry(`не записали оплату: ${error.message}`);
    }
  } else if (payment.status === "canceled" && order.status !== "paid") {
    const { error } = await supabase
      .from("orders").update({ status: "canceled" }).eq("id", orderId);
    if (error) return retry(`не записали отмену: ${error.message}`);
  }

  return ok();
});
