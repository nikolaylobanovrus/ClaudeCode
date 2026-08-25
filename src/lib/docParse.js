// Автозаполнение анкеты из документов: подготовка файлов, вызов Edge
// Function parse-documents и аккуратное слияние результата в черновик.
// Файлы уходят на сервер распознавания и НЕ сохраняются (см. дисклеймер
// в DocAutofill и docs/anthropic-setup.md).
import { supabase as cfg } from "../data/content.js";
import { validateInn, validateInnOrg, validateKpp, validateOktmo } from "../wizard/validation.js";

export const MAX_FILES = 10;
// 10 МБ — с запасом ниже серверного порога (12 МБ сырых байт): раньше
// 15 МБ raw давали ровно 20 МБ base64 = граница гейтвея Supabase, и
// большие тела обрывались БЕЗ ответа («нет связи»).
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
// Многостраничные PDF — главный источник таймаутов распознавания.
const MAX_PDF_PAGES = 20;
// Сервер считает лимит в СТРАНИЦАХ, а не в выбранных файлах: PDF мы
// разворачиваем в картинки сами. Три PDF по четыре страницы — уже 12
// картинок, и раньше сервер отвечал 400 «не больше 10 файлов за один раз»,
// хотя человек выбрал три файла. Проверяем итог после разворачивания.
// Держим в согласии с сервером (supabase/functions/parse-documents).
const MAX_PAGES = 20;
// Фото даунскейлится до этого размера по длинной стороне: выше рабочего
// разрешения модели, поэтому на качество распознавания не влияет, а вес
// снимка с телефона падает с ~8 МБ до сотен КБ.
const IMAGE_MAX_SIDE = 2000;
const JPEG_QUALITY = 0.82;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// code уходит в телеметрию (autofill_fail reason) первым словом, чтобы
// в Метрике отличать сеть/таймаут/HTTP-статусы, а не один русский текст.
export class DocParseError extends Error {
  constructor(message, code = "client") {
    super(message);
    this.code = code;
  }
}

// PDF → страницы-картинки. Сервис распознавания рендерит присланный PDF
// сам, но в низком разрешении: в бланках ФНС буквы стоят в клетках, и при
// таком рендере имя, отчество и название организации просто исчезают
// (проверено на декларации клиента — пропадали и у haiku, и у sonnet).
// Рендерим страницы сами в ~200 dpi: те же поля читаются без ошибок.
const PDF_PAGE_MAX_SIDE = 2400; // до сжатия на стороне модели (1568 px)
const PDF_JPEG_QUALITY = 0.85;

async function pdfToImages(file) {
  const pdfjs = await import("pdfjs-dist");
  // Воркер в том же бандле: отдельный CDN-файл сломался бы на Pages.
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  // Страница ~2400 px весит ~0,5 МБ: у толстых документов снижаем сторону,
  // чтобы уложиться в лимит тела запроса (10 МБ) без обрыва на гейтвее.
  const maxSide =
    doc.numPages <= 8 ? PDF_PAGE_MAX_SIDE : doc.numPages <= 15 ? 1900 : 1600;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, maxSide / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    // Бланки печатаются на белом: без заливки прозрачный фон станет чёрным.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", PDF_JPEG_QUALITY));
    canvas.width = canvas.height = 0; // освобождаем память сразу
    if (blob) pages.push({ name: `${file.name} — стр. ${n}`, mediaType: "image/jpeg", blob });
  }
  doc.destroy?.();
  return pages;
}

// Фото → сжатый JPEG через canvas. Заодно конвертирует HEIC/HEIF, если
// браузер умеет их декодировать (Safari умеет). PDF разбирается на
// страницы-картинки (см. pdfToImages), при сбое уходит на сервер как есть.
async function prepareFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES)
      throw new DocParseError(`«${file.name}»: PDF больше 10 МБ — сожмите или разбейте на части`, "pdf_size");
    try {
      const pages = await pdfToImages(file);
      if (pages.length) return pages;
    } catch {
      // Битый/зашифрованный PDF — пусть сервер попробует прочитать сам.
    }
    return { name: file.name, mediaType: "application/pdf", blob: file, pdf: true };
  }

  const isKnownImage = IMAGE_TYPES.includes(file.type);
  const looksLikeImage = isKnownImage || /^image\//.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!looksLikeImage)
    throw new DocParseError(`«${file.name}»: приложите фото (JPG/PNG) или PDF`);

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Браузер не смог декодировать (обычно HEIC вне Safari).
    if (isKnownImage) return { name: file.name, mediaType: file.type, blob: file };
    throw new DocParseError(
      `«${file.name}»: этот формат фото не читается браузером — сделайте скриншот документа и приложите его`
    );
  }

  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new DocParseError(`«${file.name}»: не получилось обработать фото`);
  return { name: file.name, mediaType: "image/jpeg", blob };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] || "");
    r.onerror = () => reject(new DocParseError("не получилось прочитать файл"));
    r.readAsDataURL(blob);
  });
}

// Главная функция: файлы → edge function → { patch, warnings }.
export async function parseDocuments(fileList, { year, types }) {
  const files = Array.from(fileList);
  if (!files.length) throw new DocParseError("выберите хотя бы один файл");
  if (files.length > MAX_FILES)
    throw new DocParseError(`не больше ${MAX_FILES} файлов за один заход — остальные добавьте вторым заходом`);

  const prepared = [];
  let total = 0;
  for (const f of files) {
    // PDF возвращает массив страниц-картинок, остальное — один файл.
    const parts = [await prepareFile(f)].flat();
    if (parts.length > MAX_PDF_PAGES)
      throw new DocParseError(
        `в «${f.name}» слишком много страниц (${parts.length}) — сфотографируйте нужные страницы или загрузите по частям`,
        "pdf_pages"
      );
    for (const p of parts) {
      total += p.blob.size;
      prepared.push(p);
    }
  }
  if (prepared.length > MAX_PAGES)
    throw new DocParseError(
      `получилось ${prepared.length} страниц — за один заход распознаём не больше ${MAX_PAGES}. ` +
        "Загрузите часть документов сейчас, остальные — вторым заходом.",
      "too_many_pages"
    );
  if (total > MAX_TOTAL_BYTES)
    throw new DocParseError("файлы слишком большие даже после сжатия — разбейте на два захода", "total_size");

  const payload = {
    year,
    types,
    files: await Promise.all(
      prepared.map(async (p) => ({
        name: p.name,
        mediaType: p.mediaType,
        dataBase64: await blobToBase64(p.blob),
      }))
    ),
  };

  // 125 с — заметно меньше wall-clock лимита воркера Supabase (~150 с):
  // клиентский таймер должен сработать РАНЬШЕ обрыва на платформе, иначе
  // вместо TimeoutError браузер получает оборванный сокет («нет связи»).
  // Сервер, в свою очередь, режет вызов Anthropic на 110 с.
  const post = (timeoutMs) =>
    fetch(`${cfg.url}/functions/v1/parse-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  const asTimeout = (e) => {
    if (e?.name !== "TimeoutError") return null;
    return new DocParseError(
      "распознавание идёт дольше обычного — загрузите меньше файлов за раз (по 3–5) и повторите",
      "timeout"
    );
  };

  let res;
  try {
    res = await post(125_000);
  } catch (e1) {
    const t1 = asTimeout(e1);
    if (t1) throw t1;
    // Сетевой обрыв: у части пользователей антивирус/VPN/провайдер режет
    // именно КРУПНЫЕ тела к CDN (preflight проходит, POST исчезает).
    // Одна повторная попытка — флапающий канал часто пропускает со второго
    // раза; риск двойного вызова распознавания минимален (обрыв = недоставка).
    await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await post(60_000);
    } catch (e2) {
      const t2 = asTimeout(e2);
      if (t2) throw t2;
      // Самодиагностика: мелкий запрос к тому же адресу. Проходит → сеть
      // жива, но большие тела режутся по дороге; нет → соединения нет вовсе.
      const alive = await fetch(`${cfg.url}/functions/v1/parse-documents`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(10_000),
      })
        .then((r) => r.ok)
        .catch(() => false);
      throw alive
        ? new DocParseError(
            "файлы не доходят до сервера — похоже, их блокирует антивирус, VPN или сеть. Попробуйте другой браузер, мобильный интернет или фото вместо PDF",
            "upload_blocked"
          )
        : new DocParseError(
            "нет соединения с сервисом распознавания — проверьте интернет и повторите",
            "offline"
          );
    }
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.patch)
    throw new DocParseError(
      data?.error || "не получилось распознать документы",
      `http_${res.status}`
    );
  return data;
}

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

// Слияние распознанного в черновик: НИКОГДА не затирает то, что пользователь
// уже ввёл руками. Возвращает { draftPatch, applied } — applied описывает,
// что реально подставили (для отчёта в UI).
export function mergePatch(draft, patch) {
  const applied = [];
  const skipped = []; // распознано, но не прошло проверку — вписать вручную
  const draftPatch = {};

  // Реквизиты с контрольной суммой/фиксированной длиной подставляем ТОЛЬКО
  // если они корректны: в бланках ФНС цифры стоят по клеткам, и модель
  // иногда прихватывает лишний символ. Пустое поле лучше правдоподобного
  // мусора — его человек может не заметить, а ФНС отклонит декларацию.
  const checkers = {
    "personal.inn": [validateInn, "ИНН"],
    "personal.oktmo": [validateOktmo, "ОКТМО"],
    "income.inn": [validateInnOrg, "ИНН работодателя"],
    "income.kpp": [validateKpp, "КПП"],
    "income.oktmo": [validateOktmo, "ОКТМО работодателя"],
  };
  const valid = (key, value) => {
    const rule = checkers[key];
    if (!rule || !filled(value)) return true;
    if (!rule[0](String(value))) return true;
    if (!skipped.includes(rule[1])) skipped.push(rule[1]);
    return false;
  };

  const mergeSection = (key, labels) => {
    const src = patch?.[key];
    if (!src?.found) return;
    const target = { ...draft[key] };
    let touched = false;
    for (const [field, label] of Object.entries(labels)) {
      if (filled(src[field]) && !filled(target[field])) {
        if (!valid(`${key}.${field}`, src[field])) continue;
        target[field] = String(src[field]).trim();
        applied.push(label);
        touched = true;
      }
    }
    if (touched) draftPatch[key] = target;
  };

  mergeSection("personal", {
    lastName: "фамилия",
    firstName: "имя",
    middleName: "отчество",
    inn: "ИНН",
    birthDate: "дата рождения",
    birthPlace: "место рождения",
    passportSeries: "серия паспорта",
    passportNumber: "номер паспорта",
    passportDate: "дата выдачи паспорта",
    passportIssuer: "кем выдан",
    phone: "телефон",
    ifns: "код инспекции",
    oktmo: "ОКТМО",
  });
  mergeSection("property", {
    address: "адрес объекта",
    cadastral: "кадастровый номер",
    cost: "стоимость жилья",
    dateReg: "дата регистрации права",
    dateAct: "дата акта приёма-передачи",
    interestPaid: "проценты по ипотеке",
  });
  // Продажа: сервер распознаёт ОДИН договор за заход, поэтому распознанное
  // кладём в первый объект списка. Второй договор человек загружает вторым
  // заходом и вписывает во вторую карточку — иначе мы бы затирали первую.
  const saleSrc = patch?.sale;
  if (saleSrc?.found) {
    const list = Array.isArray(draft.sales)
      ? draft.sales
      : draft.sale && typeof draft.sale === "object"
        ? [draft.sale]
        : [];
    const target = { ...(list[0] || {}) };
    let touched = false;
    const SALE_LABELS = {
      price: "цена продажи",
      saleDate: "дата продажи",
      buyerName: "покупатель",
      buyerInn: "ИНН покупателя",
      expenses: "расходы на покупку",
      cadastralNumber: "кадастровый номер",
      cadastralValue: "кадастровая стоимость",
      acquireDate: "дата приобретения",
    };
    for (const [field, label] of Object.entries(SALE_LABELS)) {
      if (filled(saleSrc[field]) && !filled(target[field])) {
        target[field] = String(saleSrc[field]).trim();
        applied.push(label);
        touched = true;
      }
    }
    if (touched) draftPatch.sales = [target, ...list.slice(1)];
  }
  mergeSection("medical", { ordinary: "лечение", expensive: "дорогостоящее лечение" });
  mergeSection("iis", { contribution: "взносы на ИИС" });
  mergeSection("insurance", { amount: "страхование жизни" });
  mergeSection("sport", { amount: "спорт и фитнес" });
  mergeSection("bank", { bik: "БИК", account: "номер счёта" });
  // Числовые реквизиты модель может вернуть с пробелами — приводим к цифрам,
  // как это делают поля ввода.
  if (draftPatch.bank)
    for (const f of ["bik", "account"])
      if (draftPatch.bank[f]) draftPatch.bank[f] = String(draftPatch.bank[f]).replace(/\D/g, "");
  if (draftPatch.personal) {
    // Реквизиты модель выписывает по одной цифре через дефис (так она не
    // переставляет порядок в клеточных бланках) — приводим к виду поля.
    for (const f of ["inn", "ifns", "oktmo", "passportSeries", "passportNumber"])
      if (draftPatch.personal[f]) draftPatch.personal[f] = String(draftPatch.personal[f]).replace(/\D/g, "");
    // Телефон приводим к виду поля ввода: +7 (900) 000-00-00.
    const ph = String(draftPatch.personal.phone || "").replace(/\D/g, "");
    if (ph.length === 11)
      draftPatch.personal.phone = `+7 (${ph.slice(1, 4)}) ${ph.slice(4, 7)}-${ph.slice(7, 9)}-${ph.slice(9)}`;
    else if (ph) delete draftPatch.personal.phone; // мусор не подставляем
  }

  // education: self — как обычное поле; children заполняем только если
  // у пользователя список детей пуст.
  const edu = patch?.education;
  if (edu?.found) {
    const target = { ...draft.education };
    let touched = false;
    if (filled(edu.self) && !filled(target.self)) {
      target.self = String(edu.self).trim();
      applied.push("своё обучение");
      touched = true;
    }
    const kids = (edu.children || []).filter((c) => filled(c?.amount));
    if (kids.length && !(draft.education.children || []).length) {
      target.children = kids.map((c) => ({ amount: String(c.amount).trim() }));
      applied.push(`обучение детей (${kids.length})`);
      touched = true;
    }
    if (touched) draftPatch.education = target;
  }

  // incomes: пользовательский ввод не трогаем. Заменяем целиком только если
  // в черновике единственная пустая запись; иначе — дописываем новых
  // работодателей (по ИНН), не дублируя.
  const foundIncomes = (patch?.incomes || []).filter(
    (i) => filled(i?.income) || filled(i?.name) || filled(i?.inn)
  );
  if (foundIncomes.length) {
    const digitsOnly = (v) => String(v || "").replace(/\D/g, "");
    const checked = (field, v) => (valid(`income.${field}`, v) ? v : "");
    const clean = foundIncomes.map((i) => ({
      name: String(i.name || "").trim(),
      inn: checked("inn", digitsOnly(i.inn)),
      kpp: checked("kpp", digitsOnly(i.kpp)),
      oktmo: checked("oktmo", digitsOnly(i.oktmo)),
      income: String(i.income || "").trim(),
      withheld: String(i.withheld || "").trim(),
    }));
    const existing = draft.incomes || [];
    const isEmptyIncome = (i) =>
      !filled(i.name) && !filled(i.inn) && !filled(i.income) && !filled(i.withheld);
    if (existing.every(isEmptyIncome)) {
      draftPatch.incomes = clean;
      applied.push(`доходы: ${clean.length} работодател${clean.length === 1 ? "ь" : "я(ей)"}`);
    } else {
      // Частично заполненные записи ДОПОЛНЯЕМ (раньше распознанное просто
      // терялось: совпал ИНН — и название, КПП, ОКТМО, суммы не подставлялись).
      // Ручной ввод по-прежнему приоритетнее: пишем только в пустые поля.
      const next = existing.map((row) => ({ ...row }));
      const used = new Set();
      let touched = 0;
      const findMatch = (rec) => {
        const byInn = next.findIndex((r, k) => !used.has(k) && r.inn && rec.inn && r.inn === rec.inn);
        if (byInn >= 0) return byInn;
        // Строка без ИНН (человек начал вписывать что-то одно) — берём первую
        // подходящую: пустую или ту, где ИНН ещё не указан.
        return next.findIndex((r, k) => !used.has(k) && !filled(r.inn));
      };
      const extra = [];
      for (const rec of clean) {
        const idx = findMatch(rec);
        if (idx < 0) {
          extra.push(rec);
          continue;
        }
        used.add(idx);
        for (const f of ["name", "inn", "kpp", "oktmo", "income", "withheld"]) {
          if (filled(rec[f]) && !filled(next[idx][f])) {
            next[idx][f] = rec[f];
            touched++;
          }
        }
      }
      if (touched || extra.length) {
        draftPatch.incomes = [...next, ...extra];
        if (touched) applied.push(`доходы: дозаполнено полей — ${touched}`);
        if (extra.length) applied.push(`доходы: +${extra.length} работодатель(я)`);
      }
    }
  }

  return { draftPatch, applied, skipped };
}
