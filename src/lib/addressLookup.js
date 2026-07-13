// Подсказки адреса и реквизиты налоговой (ИФНС/ОКТМО) через Edge Function
// suggest-address (DaData). Адрес не сохраняется — см. docs/dadata-setup.md.
import { supabase as cfg } from "../data/content.js";

// → [{ value, oktmo, taxOffice }]
export async function suggestAddress(query) {
  const res = await fetch(`${cfg.url}/functions/v1/suggest-address`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.anonKey}`,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.suggestions))
    throw new Error(data?.error || "сервис подсказок недоступен");
  return data.suggestions;
}
