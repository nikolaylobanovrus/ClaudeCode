// Слияние черновика с тем, что уже лежит в хранилище.
//
// Черновик один на все вкладки сайта, и запись «как есть» затирает чужое.
// Анкету пишем свою — человек правит её здесь и сейчас. А вот ОПЛАТУ
// затирать нельзя ничем:
//
//  - оплаченные комплекты (purchases) — их могла добавить соседняя вкладка,
//    пока в этой открыт черновик постарше. Затёрли — человек заплатил, а
//    доступа нет;
//  - неподтверждённый заказ (status === "waiting") — деньги у ЮKassa уже
//    списаны, вебхук ещё не дошёл. Он пропадал и от «Начать заново» (RESET
//    обнуляет order), и от второй вкладки. Возвращаем его, пока по нему нет
//    покупки: как только оплата подтверждена, заказ становится покупкой и
//    воскрешать его незачем.
//
// Функция чистая: хранилище передаётся аргументом, поэтому её поведение
// проверяется в Node (scripts/check-purchase.mjs), а не только в браузере.
export function mergeStored(draft, storage) {
  let stored = null;
  try {
    stored = JSON.parse(storage?.getItem?.(DRAFT_KEY) || "null");
  } catch {
    return draft;
  }
  if (!stored || typeof stored !== "object") return draft;

  const purchases = [...(draft.purchases || [])];
  for (const p of stored.purchases || [])
    if (p?.id && !purchases.some((x) => x.id === p.id)) purchases.push(p);

  let order = draft.order;
  if (
    !order &&
    stored.order?.status === "waiting" &&
    !purchases.some((x) => x.id === stored.order.id)
  )
    order = stored.order;

  return { ...draft, purchases, order: order || null };
}

export const DRAFT_KEY = "ns.decl.draft.v1";
