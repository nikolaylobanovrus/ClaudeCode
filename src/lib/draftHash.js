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
  // Первичная декларация (корректировка 0) хешируется БЕЗ поля correction:
  // оплаты, сделанные до появления уточнёнки, должны узнаваться и после
  // миграции черновика (loadDraft дописывает correction: 0).
  if (!Number(snap.correction)) delete snap.correction;
  return snap;
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
export function findPurchase(draft, hash) {
  if (!hash) return null;
  return (draft?.purchases || []).find((p) => p.draftHash === hash) || null;
}
