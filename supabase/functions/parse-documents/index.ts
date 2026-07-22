// Edge Function: распознавание документов для автозаполнения анкеты 3-НДФЛ.
// API-ключ Anthropic живёт только здесь (env), фронтенд его не видит.
// Настройка и деплой: docs/anthropic-setup.md.
//
// Вход:  POST { files: [{ name, mediaType, dataBase64 }], year, types[] }
// Выход: { patch: {...секции черновика...}, warnings: string[] }
//
// ПРИВАТНОСТЬ: файлы живут только в памяти функции на время запроса —
// НЕ записываются в Storage, БД или логи (логируются только метаданные:
// количество, размер, латентность). Anthropic не обучает модели на данных
// API; хранение на их стороне — до 30 дней исключительно для контроля
// злоупотреблений.
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// Модель сменяема без передеплоя кода — через секрет ANTHROPIC_MODEL.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 10;
const MAX_TOTAL_BASE64 = 20 * 1024 * 1024; // тех. потолок тела запроса
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Схема structured output зеркалит секции черновика мастера
// (src/wizard/WizardContext.jsx initialDraft). Все суммы — строки-числа
// без пробелов, даты — YYYY-MM-DD. found=false → секция не найдена в
// документах, клиент её не применяет.
const money = { type: "string", description: "Сумма в рублях, цифры без пробелов (копейки через точку или без)" };
const dateStr = { type: "string", description: "Дата в формате YYYY-MM-DD" };
const section = (props: Record<string, unknown>, description: string) => ({
  type: "object",
  description,
  additionalProperties: false,
  required: ["found", ...Object.keys(props)],
  properties: {
    found: { type: "boolean", description: "true, только если данные этой секции реально найдены в документах" },
    ...props,
  },
});

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["personal", "incomes", "property", "sale", "medical", "education", "iis", "insurance", "warnings"],
  properties: {
    personal: section(
      {
        lastName: { type: "string" },
        firstName: { type: "string" },
        middleName: { type: "string" },
        inn: { type: "string", description: "ИНН физлица, 12 цифр" },
        birthDate: dateStr,
        birthPlace: { type: "string" },
        passportSeries: { type: "string", description: "4 цифры" },
        passportNumber: { type: "string", description: "6 цифр" },
        passportDate: dateStr,
        passportIssuer: { type: "string", description: "Кем выдан, дословно" },
      },
      "Данные налогоплательщика (паспорт РФ, шапка справки о доходах)"
    ),
    incomes: {
      type: "array",
      description: "По одной записи на каждую справку о доходах (2-НДФЛ) / работодателя",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "inn", "kpp", "oktmo", "income", "withheld"],
        properties: {
          name: { type: "string", description: "Название организации (налогового агента)" },
          inn: { type: "string", description: "ИНН налогового агента, 10 цифр (у ИП 12)" },
          kpp: { type: "string", description: "КПП, 9 цифр; у ИП пусто" },
          oktmo: { type: "string", description: "ОКТМО из раздела 1 справки" },
          income: { ...money, description: "Общая сумма дохода (раздел 5 справки), руб" },
          withheld: { ...money, description: "Сумма налога удержанная (раздел 5), руб" },
        },
      },
    },
    property: section(
      {
        address: { type: "string", description: "Адрес объекта недвижимости" },
        cadastral: { type: "string", description: "Кадастровый номер XX:XX:XXXXXXX:XXX" },
        cost: { ...money, description: "Стоимость жилья по договору" },
        dateReg: { ...dateStr, description: "Дата регистрации права собственности (выписка ЕГРН)" },
        dateAct: { ...dateStr, description: "Дата акта приёма-передачи (для ДДУ)" },
        interestPaid: { ...money, description: "Проценты, фактически уплаченные банку (справка банка)" },
      },
      "Покупка жилья и ипотека (договор купли-продажи/ДДУ, выписка ЕГРН, справка банка о процентах)"
    ),
    sale: section(
      {
        price: { ...money, description: "Цена ПРОДАЖИ автомобиля по договору купли-продажи, руб" },
        saleDate: { ...dateStr, description: "Дата договора продажи автомобиля" },
        buyerName: { type: "string", description: "ФИО покупателя (кому продали автомобиль), из договора" },
        buyerInn: { type: "string", description: "ИНН покупателя, если указан в договоре (12 цифр у физлица); иначе пусто" },
        expenses: { ...money, description: "Цена, за которую этот автомобиль был РАНЕЕ КУПЛЕН налогоплательщиком (из его договора покупки) — для вычета по расходам; заполняй только если приложен договор покупки" },
      },
      "Продажа автомобиля (иного имущества): договор купли-продажи ТС на продажу и/или на покупку"
    ),
    medical: section(
      {
        ordinary: { ...money, description: "Сумма по справкам с кодом услуги 1 (обычное лечение), суммарно" },
        expensive: { ...money, description: "Сумма по справкам с кодом услуги 2 (дорогостоящее), суммарно" },
      },
      "Справки об оплате медицинских услуг для налоговых органов"
    ),
    education: section(
      {
        self: { ...money, description: "Оплата своего обучения за год, суммарно" },
        children: {
          type: "array",
          description: "Оплата обучения детей: по одной записи на ребёнка",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["amount"],
            properties: { amount: money },
          },
        },
      },
      "Договоры и квитанции/справки об оплате обучения"
    ),
    iis: section(
      { contribution: { ...money, description: "Взносы на ИИС за год" } },
      "Подтверждение взносов на ИИС (брокерский отчёт, платёжки)"
    ),
    insurance: section(
      { amount: { ...money, description: "Взносы по договору страхования жизни за год" } },
      "Договор добровольного страхования жизни (от 5 лет) и платежи"
    ),
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Короткие предупреждения по-русски: нечитаемые места, сомнительные цифры, документы не за тот год",
    },
  },
};

const TYPE_HINTS: Record<string, string> = {
  kvartira: "покупка жилья (договор, выписка ЕГРН) → property",
  ipoteka: "проценты по ипотеке (справка банка) → property.interestPaid",
  lechenie: "справки об оплате медицинских услуг → medical",
  obuchenie: "оплата обучения → education",
  iis: "взносы на ИИС → iis",
  strahovanie: "страхование жизни → insurance",
  prodazha_auto: "договор купли-продажи автомобиля: цена, дата, покупатель → sale; договор ПОКУПКИ этого авто → sale.expenses",
};

function systemPrompt(year: number, types: string[]) {
  const hints = types.map((t) => TYPE_HINTS[t]).filter(Boolean);
  return [
    `Ты извлекаешь данные из российских документов для декларации 3-НДФЛ за ${year} год.`,
    "Возможные документы: справка о доходах и суммах налога физического лица (бывш. 2-НДФЛ), паспорт РФ, договор купли-продажи или ДДУ, выписка ЕГРН, справка банка об уплаченных процентах, справка об оплате медицинских услуг (код услуги 1 — обычное, 2 — дорогостоящее), договоры и квитанции об оплате обучения, документы по ИИС и страхованию жизни, договор купли-продажи автомобиля (транспортного средства).",
    "- Продажа автомобиля: из договора купли-продажи ТС, где налогоплательщик — ПРОДАВЕЦ, бери цену продажи → sale.price, дату договора → sale.saleDate, ФИО и ИНН ПОКУПАТЕЛЯ → sale.buyerName/buyerInn. Если приложен другой договор, где налогоплательщик ПОКУПАЛ этот же автомобиль (он там покупатель), его цену бери в sale.expenses. Не путай стороны: покупатель в договоре продажи — это тот, КОМУ продали.",
    hints.length
      ? `Пользователь заявил вычеты: ${hints.join("; ")} — в первую очередь ищи эти данные.`
      : "",
    "Правила:",
    `- Суммы бери строго за ${year} год; если в документе другой год — не заполняй и добавь предупреждение.`,
    "- В справке о доходах: доход = «Общая сумма дохода» раздела 5, налог = «Сумма налога удержанная»; ИНН/КПП/ОКТМО агента — из раздела 1. Отдельная запись incomes на каждую справку.",
    "- Ничего не выдумывай и не додумывай: значение не читается или отсутствует — оставь поле пустым, секцию без данных помечай found=false.",
    "- Числа пиши цифрами без пробелов и знаков валюты; даты — YYYY-MM-DD.",
    "- Все предупреждения — по-русски, коротко.",
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY)
    return json({ error: "распознавание не настроено" }, 503);

  // Киллсвитч: серверная проверка флага (клиент проверяет его же раньше).
  const { data: enabled } = await supabase.rpc("feature_enabled", {
    p_key: "doc_autofill",
  });
  if (!enabled) return json({ error: "функция временно отключена" }, 503);

  let files: { name?: string; mediaType?: string; dataBase64?: string }[] = [];
  let year = new Date().getFullYear() - 1;
  let types: string[] = [];
  try {
    const body = await req.json();
    files = Array.isArray(body?.files) ? body.files : [];
    if (Number.isInteger(body?.year)) year = body.year;
    if (Array.isArray(body?.types)) types = body.types.map(String);
  } catch {
    return json({ error: "некорректный запрос" }, 400);
  }

  if (!files.length) return json({ error: "нет файлов" }, 400);
  if (files.length > MAX_FILES)
    return json({ error: `не больше ${MAX_FILES} файлов за один раз` }, 400);
  let total = 0;
  for (const f of files) {
    const data = f?.dataBase64;
    const mt = f?.mediaType ?? "";
    if (!data || typeof data !== "string")
      return json({ error: "файл без содержимого" }, 400);
    if (mt !== "application/pdf" && !IMAGE_TYPES.includes(mt))
      return json({ error: `формат ${mt || "неизвестен"} не поддерживается — приложите фото (JPG/PNG) или PDF` }, 415);
    total += data.length;
  }
  if (total > MAX_TOTAL_BASE64)
    return json({ error: "файлы слишком большие — уменьшите фото или разбейте на два захода" }, 413);

  const content: unknown[] = files.map((f) =>
    f.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.dataBase64 } }
      : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.dataBase64 } }
  );
  content.push({
    type: "text",
    text: `Извлеки из приложенных документов данные для декларации 3-НДФЛ за ${year} год по схеме.`,
  });

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: systemPrompt(year, types),
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      }),
    });
  } catch {
    return json({ error: "сервис распознавания недоступен, попробуйте позже" }, 502);
  }

  if (res.status === 429 || res.status === 529)
    return json({ error: "сервис распознавания перегружен — попробуйте через минуту" }, 503);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("anthropic error", res.status, detail.slice(0, 300));
    return json({ error: "не получилось распознать документы" }, 502);
  }

  const msg = await res.json();
  // stop_reason проверяем ДО чтения content (refusal → content пуст/частичен).
  if (msg.stop_reason === "refusal")
    return json({ error: "не удалось распознать эти документы" }, 422);
  if (msg.stop_reason === "max_tokens")
    return json({ error: "документов слишком много за один заход — разбейте на два" }, 422);

  const text = (msg.content ?? []).find((b: { type: string }) => b.type === "text")?.text;
  let patch: unknown;
  try {
    patch = JSON.parse(text);
  } catch {
    return json({ error: "не получилось распознать документы" }, 502);
  }

  // Только метаданные — содержимое файлов и результат НЕ логируются.
  console.log(
    `parsed files=${files.length} size=${Math.round(total / 1024)}KB model=${MODEL} ms=${Date.now() - started}`
  );

  const { warnings = [], ...sections } = patch as Record<string, unknown> & { warnings?: string[] };
  return json({ patch: sections, warnings });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
