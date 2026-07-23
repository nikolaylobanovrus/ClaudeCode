// Яндекс.Метрика: безопасные обёртки (ym может ещё не загрузиться / блок рекламы).
export const YM_ID = 110971853

export function ymGoal(name, params) {
  try { window.ym && window.ym(YM_ID, 'reachGoal', name, params) } catch { /* no-op */ }
}

export function ymHit(url) {
  try { window.ym && window.ym(YM_ID, 'hit', url) } catch { /* no-op */ }
}

// Покупка: цель + ecommerce-доход (dataLayer). token — id транзакции (для дедупликации).
export function ymPurchase(token, pkgCode, priceRub) {
  ymGoal('purchase', { pkg: pkgCode, price: priceRub })
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
