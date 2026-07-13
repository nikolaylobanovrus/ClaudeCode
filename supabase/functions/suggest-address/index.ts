// Edge Function: подсказки адреса + определение ИФНС/ОКТМО (DaData).
// Токен DaData живёт только здесь (секрет DADATA_TOKEN), фронтенд его
// не видит. Настройка и деплой: docs/dadata-setup.md.
//
// Вход:  POST { query: string }
// Выход: { suggestions: [{ value, oktmo, taxOffice }] }
//
// ПРИВАТНОСТЬ: адрес используется только для запроса подсказок — не
// пишется в БД и не логируется (логируются только метаданные: длина
// запроса, число подсказок, латентность).
import { createClient } from "npm:@supabase/supabase-js@2";

const DADATA_TOKEN = Deno.env.get("DADATA_TOKEN") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!DADATA_TOKEN) return json({ error: "подсказки адреса не настроены" }, 503);

  // Киллсвитч: серверная проверка флага (клиент проверяет его же раньше).
  const { data: enabled } = await supabase.rpc("feature_enabled", {
    p_key: "address_lookup",
  });
  if (!enabled) return json({ error: "функция временно отключена" }, 503);

  let query = "";
  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim().slice(0, 300);
  } catch {
    return json({ error: "некорректный запрос" }, 400);
  }
  if (query.length < 3) return json({ suggestions: [] });

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${DADATA_TOKEN}`,
        },
        body: JSON.stringify({ query, count: 6 }),
      }
    );
  } catch {
    return json({ error: "сервис подсказок недоступен, попробуйте позже" }, 503);
  }
  if (!res.ok) {
    console.error("dadata error", res.status);
    return json({ error: "сервис подсказок недоступен, попробуйте позже" }, 503);
  }

  const data = await res.json().catch(() => null);
  const suggestions = (data?.suggestions ?? []).map(
    (s: { value?: string; data?: { oktmo?: string; tax_office?: string } }) => ({
      value: s.value ?? "",
      oktmo: s.data?.oktmo ?? "",
      taxOffice: s.data?.tax_office ?? "",
    })
  );

  // Только метаданные — сам адрес не логируется.
  console.log(
    `suggested len=${query.length} results=${suggestions.length} ms=${Date.now() - started}`
  );
  return json({ suggestions });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
