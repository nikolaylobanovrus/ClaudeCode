// Яндекс Метрика: безопасные обёртки. Счётчик подключён в index.html;
// если скрипт заблокирован (адблок) или не загрузился — вызовы молча
// игнорируются и не ломают сайт.
import { vkGoal } from "./vkpixel.js";

const ID = 110487569;

// Цель (конверсия). Имена целей создаются в Метрике: Настройки → Цели →
// «JavaScript-событие» с тем же идентификатором. Каждая цель зеркалится
// в пиксель VK Рекламы (для аудиторий ретаргетинга) — одним местом,
// чтобы не дублировать вызовы по всем компонентам.
export function ymGoal(name, params) {
  try {
    window.ym?.(ID, "reachGoal", name, params);
  } catch {
    /* ignore */
  }
  vkGoal(name, params?.amount);
}

// Просмотр страницы в SPA: роутер меняет URL без перезагрузки, без этого
// Метрика видит только первый экран сессии.
export function ymHit(url) {
  try {
    window.ym?.(ID, "hit", url);
  } catch {
    /* ignore */
  }
}

// Электронная коммерция (init: ecommerce:"dataLayer"): покупка комплекта
// документов — доход попадает в отчёты «Электронная коммерция».
export function ymPurchase(orderId, amount) {
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
    /* ignore */
  }
}
