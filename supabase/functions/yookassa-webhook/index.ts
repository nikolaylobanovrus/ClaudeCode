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
  // Всегда отвечаем 200 — иначе ЮKassa будет ретраить бесконечно.
  const ok = () => new Response("ok", { status: 200 });
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
  const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: "Basic " + btoa(`${SHOP_ID}:${SECRET_KEY}`) },
  });
  if (!res.ok) return ok();
  const payment = await res.json();

  const orderId = payment?.metadata?.orderId;
  if (!orderId) return ok();

  const { data: order } = await supabase
    .from("orders")
    .select("id, amount, provider_payment_id, status")
    .eq("id", orderId)
    .single();
  if (!order || order.provider_payment_id !== paymentId) return ok();

  if (payment.status === "succeeded") {
    // Сумма платежа обязана совпадать с суммой заказа.
    const paidAmount = Math.round(Number(payment.amount?.value ?? 0));
    if (paidAmount >= order.amount && order.status !== "paid") {
      await supabase
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  } else if (payment.status === "canceled" && order.status !== "paid") {
    await supabase.from("orders").update({ status: "canceled" }).eq("id", orderId);
  }

  return ok();
});
