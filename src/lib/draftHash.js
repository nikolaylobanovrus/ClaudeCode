// Хеш содержимого анкеты: привязывает оплату к конкретным данным.
// Одна оплата = один комплект документов для одного состояния анкеты
// (год + все данные). Изменение любого поля после оплаты меняет хеш —
// шаг «Документы» перестаёт узнавать покупку и требует новую оплату.
// Возврат тех же данных возвращает тот же хеш — повторное скачивание
// оплаченного комплекта бесплатно.

// Служебные поля черновика, не влияющие на содержание документов.
const SKIP_KEYS = new Set(["order", "purchases", "step", "savedAt", "v"]);

// Детерминированная сериализация: ключи объектов сортируются, undefined
// означает отсутствие ключа (в массивах — null, как в JSON).
export function stableStringify(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") +
    "}"
  );
}

// Снимок содержательной части анкеты (то, за что платит клиент).
// Порядок выбора вычетов не содержателен — types сортируется.
export function draftSnapshot(draft) {
  const snap = {};
  for (const k of Object.keys(draft || {})) {
    if (!SKIP_KEYS.has(k)) snap[k] = draft[k];
  }
  if (Array.isArray(snap.types)) snap.types = [...snap.types].sort();
  // ПУСТОЕ НЕ ХЕШИРУЕТСЯ. Это не оптимизация, а защита оплаченного доступа.
  //
  // Каждый релиз, добавляющий поле в анкету, дописывает его всем сохранённым
  // черновикам (см. withDefaults в WizardContext). Если пустое поле влияет на
  // хеш, то у человека, оплатившего ДО релиза, хеш назавтра меняется сам
  // собой — и шаг «Документы» говорит ему «анкета изменилась после оплаты,
  // оплатите новую декларацию». Он не делал ничего.
  //
  // Раньше от этого спасались списком исключений (correction, sport), который
  // вели руками — и 10.09.2026 не обновили, добавив standard, savings и
  // socialProvided. Поэтому больше не список, а правило: пустое значение не
  // участвует в содержании документов, значит и в хеше ему делать нечего.
  return stripEmpty(snap);
}

// Рекурсивно убирает то, что не влияет на документы: пустые строки, нули,
// false, пустые массивы и объекты. Массивы, ставшие пустыми, тоже уходят —
// «ни одного ребёнка» и «поля для детей ещё не было» для документа одно и то же.
export function stripEmpty(value) {
  if (Array.isArray(value)) {
    const items = value.map(stripEmpty).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      const v = stripEmpty(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === "" || value === null || value === undefined || value === false) return undefined;
  if (typeof value === "number" && value === 0) return undefined;
  if (typeof value === "string" && Number(value) === 0 && value.trim() !== "") return undefined;
  return value;
}

export async function computeDraftHash(draft) {
  const input = stableStringify(draftSnapshot(draft));
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input)
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Среда без Web Crypto — детерминированный фолбэк (хеш сравнивается
    // только локально, на том же устройстве).
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return "fb-" + (h >>> 0).toString(16);
  }
}

// Покупка, соответствующая текущему состоянию анкеты (или null).
//
// Сначала быстрый путь — совпадение хешей. Если не совпало, сверяем СОДЕРЖАНИЕ
// со снимком, сохранённым в момент оплаты: снимок лежит в самой покупке и
// описывает ровно то, за что человек заплатил. Это страхует от смены самого
// алгоритма хеширования (покупки, сделанные прежней версией сайта, обязаны
// продолжать открываться) и от любого будущего поля, о котором мы сегодня не
// знаем. Содержание сравнивается после stripEmpty — пустое с обеих сторон
// значит одно и то же.
export function findPurchase(draft, hash) {
  const list = draft?.purchases || [];
  if (!list.length) return null;
  if (hash) {
    const byHash = list.find((p) => p.draftHash === hash);
    if (byHash) return byHash;
  }
  const current = stableStringify(draftSnapshot(draft));
  return list.find((p) => p.snapshot && stableStringify(stripEmpty(p.snapshot)) === current) || null;
}
