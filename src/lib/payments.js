// Оплата услуги «Заполнить самому». Абстракция над провайдерами:
//  - mock (по умолчанию): тестовый режим без списания денег. Заказ создаётся
//    в Supabase (или локально, если база не подключена), «оплата» помечает
//    его оплаченным через RPC mock_pay_order.
//  - yookassa: боевой режим. Платёж создаёт Supabase Edge Function
//    create-payment (секретный ключ — только там), подтверждение приходит
//    вебхуком yookassa-webhook. Включение: см. docs/yookassa-setup.md.
// Документы открываются ТОЛЬКО по статусу paid из базы — фронт сам себе
// статус не назначает (кроме офлайн-режима без Supabase).
import { supabase as cfg, selfService } from "../data/content.js";
import { sbConfigured, sbRpc } from "./supabase.js";

const PROVIDER = import.meta.env.VITE_PAY_PROVIDER || "mock";

export const isTestPayment = () => PROVIDER !== "yookassa";

// Создать заказ. Возвращает { id, provider, amount, status, confirmationUrl? }.
// contact = { phone?, email? } — попадает в чек 54-ФЗ (обязателен при
// включённой фискализации магазина ЮKassa).
export async function createOrder(clientId, contact = {}) {
  if (PROVIDER === "yookassa") {
    const res = await fetch(`${cfg.url}/functions/v1/create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: JSON.stringify({
        clientId: clientId ?? null,
        phone: contact.phone || "",
        email: contact.email || "",
      }),
    });
    if (!res.ok) throw new Error(`create-payment: HTTP ${res.status}`);
    const data = await res.json();
    return {
      id: data.orderId,
      provider: "yookassa",
      amount: data.amount ?? selfService.price,
      status: "waiting",
      confirmationUrl: data.confirmationUrl,
    };
  }

  if (sbConfigured()) {
    try {
      const id = await sbRpc("create_order", { p_client: clientId ?? null });
      if (id) return { id, provider: "mock", amount: selfService.price, status: "pending" };
    } catch {
      // Миграция заказов ещё не применена — тестовый режим работает локально.
    }
  }

  // Локальный тестовый заказ: базы нет, заказ живёт в черновике.
  return {
    id: "local-" + Math.random().toString(36).slice(2, 10),
    provider: "local",
    amount: selfService.price,
    status: "pending",
  };
}

// Тестовая «оплата» — только для mock/local-заказов. Боевой заказ ЮKassa
// «оплатить» на клиенте нельзя: его подтверждает вебхук.
export async function payMockOrder(order) {
  if (order.provider === "yookassa")
    throw new Error("оплата возможна только на странице ЮKassa");
  if (order.provider === "mock") {
    try {
      await sbRpc("mock_pay_order", { p_id: order.id });
    } catch {
      // База недоступна или миграция не применена: превращаем заказ в
      // локальный, чтобы статус в базе и в черновике не разъехались
      // (иначе шаг «Документы» увидит в базе pending и откажет).
      return { ...order, provider: "local", status: "paid" };
    }
  }
  return { ...order, status: "paid" };
}

// Актуальный статус заказа из базы: pending | waiting | paid | canceled.
// Для боевого провайдера (yookassa) проверка строгая — ошибка сети не
// считается оплатой; в тестовом режиме деградируем к статусу из черновика.
export async function fetchOrderStatus(order) {
  if (!order) return "pending";
  if (order.provider === "local") return order.status;
  try {
    const row = await sbRpc("get_order_status", { p_id: order.id });
    return row?.status || "pending";
  } catch (e) {
    if (order.provider === "yookassa") throw e;
    return order.status;
  }
}
