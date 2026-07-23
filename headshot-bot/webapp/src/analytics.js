// Яндекс.Метрика: безопасные обёртки (ym может ещё не загрузиться / блок рекламы).
export const YM_ID = 110971853

export function ymGoal(name, params) {
  try { window.ym && window.ym(YM_ID, 'reachGoal', name, params) } catch { /* no-op */ }
}

export function ymHit(url) {
  try { window.ym && window.ym(YM_ID, 'hit', url) } catch { /* no-op */ }
}

// VK Реклама (Top.Mail.Ru) — цель для оптимизации/ретаргетинга VK.
export const VK_PIXEL = '3782039'
export function vkGoal(name, value) {
  try {
    window._tmr = window._tmr || []
    window._tmr.push({ id: VK_PIXEL, type: 'reachGoal', goal: name, value })
  } catch { /* no-op */ }
}

// Общая цель воронки: шлём и в Метрику, и в VK.
export function goal(name, params) {
  ymGoal(name, params)
  vkGoal(name)
}

// Покупка: цель + ecommerce-доход (dataLayer). token — id транзакции (для дедупликации).
export function ymPurchase(token, pkgCode, priceRub) {
  ymGoal('purchase', { pkg: pkgCode, price: priceRub })
  vkGoal('purchase', priceRub)
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      ecommerce: {
        currencyCode: 'RUB',
        purchase: {
          actionField: { id: token || String(new Date().getTime()), revenue: priceRub || 0 },
          products: [{ id: pkgCode, name: pkgCode, price: priceRub || 0, quantity: 1 }],
        },
      },
    })
  } catch { /* no-op */ }
}
