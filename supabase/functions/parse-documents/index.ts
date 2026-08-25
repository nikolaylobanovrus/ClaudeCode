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
// haiku: извлечение полей по json_schema не требует opus, зато в разы
// быстрее — многостраничные PDF перестают упираться в wall-clock воркера.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Клиент присылает СТРАНИЦЫ, а не документы: многостраничный PDF он рендерит
// сам (см. docParse.js — иначе бланки ФНС теряют буквы в клетках). Поэтому
// лимит считаем в страницах: справка о доходах + паспорт + договор легко
// дают 12–15 картинок из трёх выбранных файлов. Расход всё равно ограничен
// MAX_TOTAL_RAW и таймаутом вызова.
//
// 20, а не 10: на десяти клиенты упирались в «слишком много страниц» на
// обычном наборе (справка + паспорт + договор). Настоящий потолок теперь не
// счётчик, а вес тела (MAX_TOTAL_RAW) — клиент сам мельчит страницы толстых
// PDF, чтобы в него уложиться, — и таймаут вызова.
const MAX_PAGES = 20;
// Порог по СЫРЫМ байтам (len*3/4): раньше сравнивали base64-длину с 20 МБ,
// и клиентский лимит 15 МБ raw = ровно 20 МБ base64 — большие тела резал
// гейтвей платформы БЕЗ CORS-заголовков, браузер видел «нет связи».
const MAX_TOTAL_RAW = 12 * 1024 * 1024;
// Таймаут вызова Anthropic: заведомо меньше wall-clock лимита воркера
// (~150 с), чтобы ответить СВОИМ 504 с CORS, а не оборванным сокетом.
const ANTHROPIC_TIMEOUT_MS = 110_000;
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
  required: ["personal", "incomes", "property", "sale", "medical", "education", "iis", "insurance", "sport", "bank", "warnings"],
  properties: {
    personal: section(
      {
        lastName: { type: "string" },
        firstName: { type: "string" },
        middleName: { type: "string" },
        inn: { type: "string", description: "ИНН физлица: 12 цифр, выписывай ПО ОДНОЙ цифре через дефис, ровно как они стоят в клетках бланка (например «1-4-1-4-8-9-4-6-5-1-6-7») — так не переставишь порядок" },
        birthDate: dateStr,
        birthPlace: { type: "string" },
        passportSeries: { type: "string", description: "Серия паспорта: 4 цифры, по одной через дефис (например «7-5-1-2»)" },
        passportNumber: { type: "string", description: "Номер паспорта: 6 цифр, по одной через дефис" },
        passportDate: dateStr,
        passportIssuer: { type: "string", description: "Кем выдан, дословно" },
        phone: { type: "string", description: "Номер контактного телефона налогоплательщика (11 цифр) — с титульного листа декларации («Номер контактного телефона») или из шапки справки. Выписывай ПО ОДНОЙ цифре через дефис, ровно как они стоят в клетках (например «8-9-0-0-9-3-2-8-6-7-0») — так не переставишь порядок" },
        ifns: { type: "string", description: "Код налоговой инспекции: 4 цифры, по одной через дефис — с титульного листа ранее поданной декларации 3-НДФЛ («Представляется в налоговый орган (код)»)" },
        oktmo: { type: "string", description: "ОКТМО налогоплательщика (8 или 11 цифр, по одной через дефис) по месту жительства (Раздел 1 ранее поданной декларации 3-НДФЛ); НЕ путать с ОКТМО источника выплаты (Приложение 1 строка 050 / раздел 1 справки). Если в документах есть только ОКТМО работодателя — оставь это поле ПУСТЫМ" },
      },
      "Данные налогоплательщика (паспорт РФ, шапка справки о доходах, титульный лист ранее поданной декларации 3-НДФЛ)"
    ),
    incomes: {
      type: "array",
      description: "По одной записи на каждую справку о доходах (2-НДФЛ) / работодателя",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "inn", "kpp", "oktmo", "income", "withheld"],
        properties: {
          name: { type: "string", description: "Название организации (налогового агента) ДОСЛОВНО одной строкой: клетки бланка режут слова, но пробел ставь только там, где он есть в названии («К У Р О Р Т Ы  П О В О Л Ж Ь Я» → «КУРОРТЫ ПОВОЛЖЬЯ»)" },
          inn: { type: "string", description: "ИНН налогового агента: 10 цифр (у ИП 12). Выписывай ПО ОДНОЙ цифре через дефис, ровно как они стоят в клетках бланка, например «3-6-6-6-0-1-8-0-6-0» — так не переставишь порядок" },
          kpp: { type: "string", description: "КПП: 9 цифр, тоже по одной через дефис; у ИП пусто" },
          oktmo: { type: "string", description: "ОКТМО источника выплаты: 8 или 11 цифр, по одной через дефис" },
          income: { ...money, description: "Общая сумма дохода за год, руб: в справке о доходах — раздел 5, в декларации 3-НДФЛ — Приложение 1 строка 070. Переноси ТОЧНО, без лишних нулей" },
          withheld: { ...money, description: "Сумма налога удержанная, руб: в справке — раздел 5, в декларации — Приложение 1 строка 080. Переноси ТОЧНО, без лишних нулей" },
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
        price: { ...money, description: "Цена ПРОДАЖИ по договору купли-продажи (автомобиля или недвижимости), руб" },
        saleDate: { ...dateStr, description: "Дата договора продажи" },
        buyerName: { type: "string", description: "ФИО покупателя (кому продали), из договора" },
        buyerInn: { type: "string", description: "ИНН покупателя, если указан в договоре (12 цифр у физлица); иначе пусто" },
        expenses: { ...money, description: "Цена, за которую этот объект был РАНЕЕ КУПЛЕН налогоплательщиком (из его договора покупки) — для вычета по расходам; заполняй только если приложен договор покупки" },
        // Только недвижимость (договор/ЕГРН на квартиру, дом, комнату, участок):
        cadastralNumber: { type: "string", description: "Кадастровый номер продаваемой НЕДВИЖИМОСТИ (формат XX:XX:XXXXXXX:XXX), из выписки ЕГРН или договора; для автомобиля не заполняй" },
        cadastralValue: { ...money, description: "Кадастровая стоимость продаваемой НЕДВИЖИМОСТИ, руб (из выписки ЕГРН); для автомобиля не заполняй" },
        acquireDate: { ...dateStr, description: "Дата, когда налогоплательщик приобрёл продаваемую НЕДВИЖИМОСТЬ (регистрация права по выписке ЕГРН или дата договора покупки); для автомобиля не заполняй" },
      },
      "Продажа имущества: договор купли-продажи (авто или недвижимости) на продажу и/или на покупку, выписка ЕГРН"
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
    sport: section(
      { amount: { ...money, description: "Расходы на физкультурно-оздоровительные услуги (фитнес, бассейн, секции) за год, суммарно" } },
      "Договор и кассовые чеки фитнес-клуба / спортивной организации"
    ),
    bank: section(
      {
        bik: { type: "string", description: "БИК банка, 9 цифр (начинается с 04)" },
        account: { type: "string", description: "Номер счёта налогоплательщика, 20 цифр" },
      },
      "Реквизиты для возврата: заявление о возврате внутри ранее поданной декларации 3-НДФЛ (Приложение к Разделу 1) или справка/скрин реквизитов из банка"
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
  sport: "физкультурно-оздоровительные услуги: договор и чеки фитнес-клуба → sport",
  prodazha_auto: "договор купли-продажи автомобиля: цена, дата, покупатель → sale; договор ПОКУПКИ этого авто → sale.expenses",
  prodazha_realty: "продажа недвижимости: договор купли-продажи и выписка ЕГРН → sale (цена, дата, покупатель, кадастровый номер, кадастровая стоимость, дата приобретения); договор ПОКУПКИ этого объекта → sale.expenses",
};

function systemPrompt(year: number, types: string[]) {
  const hints = types.map((t) => TYPE_HINTS[t]).filter(Boolean);
  return [
    `Ты извлекаешь данные из российских документов для декларации 3-НДФЛ за ${year} год.`,
    "Возможные документы: справка о доходах и суммах налога физического лица (бывш. 2-НДФЛ), паспорт РФ, договор купли-продажи или ДДУ, выписка ЕГРН, справка банка об уплаченных процентах, справка об оплате медицинских услуг (код услуги 1 — обычное, 2 — дорогостоящее), договоры и квитанции об оплате обучения, документы по ИИС и страхованию жизни, договор и чеки фитнес-клуба или спортивной организации (физкультурно-оздоровительные услуги), договор купли-продажи автомобиля (транспортного средства).",
    "- Продажа автомобиля: из договора купли-продажи ТС, где налогоплательщик — ПРОДАВЕЦ, бери цену продажи → sale.price, дату договора → sale.saleDate, ФИО и ИНН ПОКУПАТЕЛЯ → sale.buyerName/buyerInn. Если приложен другой договор, где налогоплательщик ПОКУПАЛ этот же автомобиль (он там покупатель), его цену бери в sale.expenses. Не путай стороны: покупатель в договоре продажи — это тот, КОМУ продали.",
    "- Продажа недвижимости: из договора купли-продажи, где налогоплательщик — ПРОДАВЕЦ, бери цену продажи → sale.price, дату → sale.saleDate, ФИО/ИНН ПОКУПАТЕЛЯ → sale.buyerName/buyerInn. Из выписки ЕГРН или договора бери кадастровый номер → sale.cadastralNumber, кадастровую стоимость → sale.cadastralValue, дату регистрации права собственности налогоплательщика (когда он приобрёл объект) → sale.acquireDate. Если приложен договор, по которому налогоплательщик ПОКУПАЛ этот объект, его цену → sale.expenses.",
    "- Ранее поданная декларация 3-НДФЛ (например, для уточнёнки): с титульного листа бери код инспекции (4 цифры) → personal.ifns, ИНН и ФИО → personal; из Раздела 1 — код по ОКТМО → personal.oktmo; из заявления о возврате внутри декларации (Приложение к Разделу 1) — БИК → bank.bik и номер счёта (20 цифр) → bank.account. Суммы доходов и налога из Приложения 1 декларации бери в incomes (ИНН/КПП/ОКТМО источника выплаты там указаны).",
    hints.length
      ? `Пользователь заявил вычеты: ${hints.join("; ")} — в первую очередь ищи эти данные.`
      : "",
    "Правила:",
    `- Суммы бери строго за ${year} год; если в документе другой год — не заполняй и добавь предупреждение.`,
    "- В справке о доходах: доход = «Общая сумма дохода» раздела 5, налог = «Сумма налога удержанная»; ИНН/КПП/ОКТМО агента — из раздела 1. Отдельная запись incomes на каждую справку.",
    "- ВНИМАНИЕ к суммам в бланках ФНС: цифры напечатаны по отдельным клеткам, а рубли и копейки разделены точкой в отдельных полях («3 3 7 8 1 9 . 0 0» = 337819.00, а НЕ 3378190). Не приклеивай копейки к рублям и не добавляй лишние нули. Пустые клетки слева и справа — незначащие, игнорируй их.",
    "- ВАЖНО про бланки, заполненные программой ФНС: КАЖДЫЙ символ стоит в своей клетке, а НЕЗАПОЛНЕННЫЕ клетки помечены прочерком «-». Прочерк — это пустота, а НЕ данные: не превращай его в цифру, не обрывай на нём значение и не считай его частью текста. Символы из соседних клеток склеивай в одно значение: «Б У З  В О  В О К О Б - - - -» → «БУЗ ВО ВОКОБ»; «В а л е р и й - - -» → «Валерий»; «3 6 6 6 0 1 8 0 6 0 - -» → «3666018060».",
    "- Контроль длины реквизитов (если получилось иначе — перечитай поле по клеткам): ИНН организации ровно 10 цифр, ИНН физлица (в том числе ИП) — 12, КПП — 9, ОКТМО — 8 или 11, код инспекции — 4, телефон — 11.",
    "- Самопроверка сумм в декларации 3-НДФЛ: сумма дохода из Приложения 1 (строка 070) должна совпадать со строкой 010 Раздела 2, а удержанный налог (строка 080) — со строкой 080 Раздела 2. Если не сходится — перечитай цифры по клеткам и исправь.",
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
  if (files.length > MAX_PAGES)
    return json({ error: `не больше ${MAX_PAGES} страниц за один раз — загрузите документы в два захода` }, 400);
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
  if (Math.floor((total * 3) / 4) > MAX_TOTAL_RAW)
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
        max_tokens: 16000,
        system: systemPrompt(year, types),
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      }),
      signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
    });
  } catch (e) {
    if ((e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError") {
      console.error(`anthropic timeout after ${Date.now() - started}ms model=${MODEL}`);
      return json({ error: "распознавание заняло слишком долго — попробуйте меньше файлов или фото вместо PDF" }, 504);
    }
    return json({ error: "сервис распознавания недоступен, попробуйте позже" }, 502);
  }

  if (res.status === 429 || res.status === 529)
    return json({ error: "сервис распознавания перегружен — попробуйте через минуту" }, 503);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("anthropic error", res.status, detail.slice(0, 300));
    // Кончились средства на счёте Anthropic: документы тут ни при чём,
    // и человек не должен думать, что виноват его файл.
    if (/credit balance|billing|insufficient/i.test(detail))
      return json({ error: "распознавание временно недоступно — заполните поля вручную, мы уже чиним" }, 503);
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
  // usage пишем, чтобы считать реальную стоимость распознавания
  // (в отчёте по балансу Anthropic) — содержимое файлов НЕ логируется.
  const u = msg.usage ?? {};
  console.log(
    `parsed files=${files.length} size=${Math.round(total / 1024)}KB model=${MODEL} ms=${Date.now() - started} in=${u.input_tokens ?? "?"} out=${u.output_tokens ?? "?"}`
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
