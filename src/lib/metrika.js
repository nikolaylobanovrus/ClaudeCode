// Яндекс.Метрика: безопасные обёртки. Счётчик подключается в index.html;
// здесь — цели воронки. Если скрипт не загрузился (блокировщик, оффлайн),
// вызовы молча игнорируются и не ломают работу сайта.
export const METRIKA_ID = 110487569;

// Цели (тип «JavaScript-событие» в интерфейсе Метрики):
//   wizard_open      — открыл анкету самозаполнения
//   payment_step     — дошёл до шага оплаты
//   pay_click        — нажал «Оплатить» (создание заказа)
//   payment_success  — оплата подтверждена (главная конверсия, 99 ₽)
//   lead_submit      — отправил заявку «сделаем за вас» (апселл)
export function reachGoal(goal, params) {
  try {
    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(METRIKA_ID, "reachGoal", goal, params);
    }
  } catch {
    /* аналитика не должна влиять на функциональность */
  }
}

// Электронная коммерция: покупка комплекта документов (доход в отчётах).
export function trackPurchase(orderId, amount) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      ecommerce: {
        currencyCode: "RUB",
        purchase: {
          actionField: { id: String(orderId), revenue: amount },
          products: [
            {
              id: "self-declaration",
              name: "Декларация 3-НДФЛ (самозаполнение)",
              price: amount,
              quantity: 1,
            },
          ],
        },
      },
    });
  } catch {
    /* см. выше */
  }
}
