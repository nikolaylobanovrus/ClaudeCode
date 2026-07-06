// Edge Function: создание платежа ЮKassa для услуги «Заполнить самому».
// Секретный ключ магазина живёт только здесь (env), фронтенд его не видит.
// Деплой и настройка: docs/yookassa-setup.md.
//
// Вход:  POST { clientId?: number, phone?: string, email?: string }
// Выход: { orderId, confirmationUrl, amount }
//
// Если передан контакт (телефон/email), в платёж добавляется чек 54-ФЗ
// (receipt) — обязателен для магазинов с включённой фискализацией.
// НДС в чеке: vat_code 1 («без НДС», подходит для УСН).
import { createClient } from "npm:@supabase/supabase-js@2";

const SHOP_ID = Deno.env.get("YOOKASSA_SHOP_ID") ?? "";
const SECRET_KEY = Deno.env.get("YOOKASSA_SECRET_KEY") ?? "";
// Базовый адрес сайта для возврата после оплаты, без завершающего "/",
// например https://nikolaylobanovrus.github.io/ClaudeCode
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return json({ error: "method not allowed" }, 405);
  if (!SHOP_ID || !SECRET_KEY || !SITE_URL)
    return json({ error: "payment provider is not configured" }, 503);

  let clientId: number | null = null;
  let phone = "";
  let email = "";
  try {
    const body = await req.json();
    clientId = body?.clientId ?? null;
    phone = String(body?.phone ?? "");
    email = String(body?.email ?? "");
  } catch {
    /* пустое тело — допустимо */
  }
  // Телефон в формат ITU E.164: только цифры, ведущая 8 → 7.
  const phoneDigits = phone.replace(/\D/g, "").replace(/^8/, "7");

  // Цена берётся из БД (self_service_price) — клиент её не диктует.
  const { data: price, error: priceErr } = await supabase.rpc("self_service_price");
  if (priceErr || !price) return json({ error: "price lookup failed" }, 500);

  // 1. Заказ в статусе waiting.
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({ client_id: clientId, amount: price, provider: "yookassa", status: "waiting" })
    .select("id")
    .single();
  if (orderErr) return json({ error: "order insert failed" }, 500);

  // 2. Платёж в ЮKassa. Idempotence-Key = id заказа: повторный вызов
  // с тем же заказом не создаст второй платёж.
  // return_url: ?order= ДО решётки — параметр читается при любом роутере.
  const returnUrl = `${SITE_URL}/?order=${order.id}#/deklaraciya/anketa`;
  const description = "Самостоятельное заполнение декларации 3-НДФЛ";
  const payload: Record<string, unknown> = {
    amount: { value: `${price}.00`, currency: "RUB" },
    capture: true,
    confirmation: { type: "redirect", return_url: returnUrl },
    description,
    metadata: { orderId: order.id },
  };
  // Чек 54-ФЗ: обязателен, если у магазина включена фискализация.
  const customer = email
    ? { email }
    : phoneDigits
      ? { phone: phoneDigits }
      : null;
  if (customer) {
    payload.receipt = {
      customer,
      items: [
        {
          description,
          quantity: "1.00",
          amount: { value: `${price}.00`, currency: "RUB" },
          vat_code: 1, // без НДС (УСН)
          payment_subject: "service",
          payment_mode: "full_payment",
        },
      ],
    };
  }
  const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": order.id,
      Authorization: "Basic " + btoa(`${SHOP_ID}:${SECRET_KEY}`),
    },
    body: JSON.stringify(payload),
  });
  if (!ykRes.ok) {
    await supabase.from("orders").update({ status: "canceled" }).eq("id", order.id);
    // Описание ошибки ЮKassa возвращаем для диагностики (без секретов).
    const yk = await ykRes.json().catch(() => null);
    return json(
      {
        error: `yookassa: HTTP ${ykRes.status}`,
        ykCode: yk?.code ?? null,
        ykDescription: yk?.description ?? null,
        ykParameter: yk?.parameter ?? null,
      },
      502
    );
  }
  const payment = await ykRes.json();

  // 3. Привязываем платёж к заказу.
  await supabase
    .from("orders")
    .update({
      provider_payment_id: payment.id,
      confirmation_url: payment.confirmation?.confirmation_url ?? null,
    })
    .eq("id", order.id);

  return json({
    orderId: order.id,
    confirmationUrl: payment.confirmation?.confirmation_url,
    amount: price,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
