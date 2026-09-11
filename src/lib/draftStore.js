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

// Восстановление анкеты из снимка, сделанного в момент оплаты.
//
// Зачем. Человек оплатил, увидел опечатку в фамилии, исправил — и шаг
// «Документы» сообщает, что анкета изменилась после оплаты и надо платить
// заново. Текст предлагал «вернуть прежние данные», но вернуть их было
// нечем: снимок лежал в черновике и никуда не показывался. Половина таких
// людей платит второй раз, вторая половина пишет нам.
//
// Снимок не равен черновику: из него выброшено пустое (см. draftSnapshot —
// так защищён хеш оплаты от релизов). Поэтому снимок не кладётся в состояние
// как есть, а накладывается на эталон: чего в снимке нет, берётся из
// initialDraft. Иначе поля, которые были пустыми, вернулись бы как undefined
// и превратили бы заполненные поля формы в неуправляемые.
export function restoreFromSnapshot(snapshot, base) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return fill(base, snapshot);
}

function fill(template, value) {
  if (value === undefined) return template;
  if (Array.isArray(template) || Array.isArray(value)) {
    if (!Array.isArray(value)) return template;
    // Шаблон элемента — первый элемент эталона (incomes, sales) либо, если
    // эталон пуст (дети, договоры), объединение полей самих элементов: так
    // у всех элементов оказывается один и тот же набор ключей.
    const proto = Array.isArray(template) && template.length
      ? template[0]
      : unionKeys(value);
    return value.map((item) => fill(proto, item));
  }
  if (isObj(template) && isObj(value)) {
    const out = {};
    for (const k of new Set([...Object.keys(template), ...Object.keys(value)]))
      out[k] = fill(template[k], value[k]);
    return out;
  }
  return value;
}

const isObj = (v) => v !== null && typeof v === "object";

// Объединение полей элементов массива: ключ, пустой у одного элемента и
// заполненный у другого, в снимке сохранился только у второго. Пустое
// значение подбираем по типу соседа — галочке нужен false, а не пустая
// строка, иначе поле формы меняет тип на ходу.
function unionKeys(items) {
  const proto = {};
  for (const it of items)
    if (isObj(it) && !Array.isArray(it))
      for (const [k, v] of Object.entries(it))
        if (!(k in proto)) proto[k] = emptyLike(v);
  return Object.keys(proto).length ? proto : undefined;
}

const emptyLike = (v) =>
  typeof v === "boolean" ? false
  : typeof v === "number" ? 0
  : Array.isArray(v) ? []
  : "";
