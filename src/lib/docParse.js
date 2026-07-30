// Автозаполнение анкеты из документов: подготовка файлов, вызов Edge
// Function parse-documents и аккуратное слияние результата в черновик.
// Файлы уходят на сервер распознавания и НЕ сохраняются (см. дисклеймер
// в DocAutofill и docs/anthropic-setup.md).
import { supabase as cfg } from "../data/content.js";

export const MAX_FILES = 10;
// 10 МБ — с запасом ниже серверного порога (12 МБ сырых байт): раньше
// 15 МБ raw давали ровно 20 МБ base64 = граница гейтвея Supabase, и
// большие тела обрывались БЕЗ ответа («нет связи»).
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
// Многостраничные PDF — главный источник таймаутов распознавания.
const MAX_PDF_PAGES = 25;
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

// Фото → сжатый JPEG через canvas. Заодно конвертирует HEIC/HEIF, если
// браузер умеет их декодировать (Safari умеет). PDF возвращается как есть.
async function prepareFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES)
      throw new DocParseError(`«${file.name}»: PDF больше 10 МБ — сожмите или разбейте на части`, "pdf_size");
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
    const p = await prepareFile(f);
    total += p.blob.size;
    prepared.push(p);
  }
  if (total > MAX_TOTAL_BYTES)
    throw new DocParseError("файлы слишком большие даже после сжатия — разбейте на два захода", "total_size");

  // Суммарный лимит страниц PDF: длинные документы гарантированно упираются
  // в таймаут распознавания — честнее остановить до отправки. pdf-lib грузим
  // лениво (он и так в бандле генерации документов, но не в бандле мастера).
  const pdfs = prepared.filter((p) => p.pdf);
  if (pdfs.length) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      let pages = 0;
      for (const p of pdfs) {
        const doc = await PDFDocument.load(await p.blob.arrayBuffer(), { ignoreEncryption: true });
        pages += doc.getPageCount();
      }
      if (pages > MAX_PDF_PAGES)
        throw new DocParseError(
          `в PDF слишком много страниц (${pages}) — сфотографируйте нужные страницы или загрузите по частям`,
          "pdf_pages"
        );
    } catch (e) {
      if (e instanceof DocParseError) throw e;
      // Не смогли посчитать страницы (битый/зашифрованный PDF) — пусть решает сервер.
    }
  }

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
  const draftPatch = {};

  const mergeSection = (key, labels) => {
    const src = patch?.[key];
    if (!src?.found) return;
    const target = { ...draft[key] };
    let touched = false;
    for (const [field, label] of Object.entries(labels)) {
      if (filled(src[field]) && !filled(target[field])) {
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
  mergeSection("sale", {
    price: "цена продажи",
    saleDate: "дата продажи",
    buyerName: "покупатель",
    buyerInn: "ИНН покупателя",
    expenses: "расходы на покупку",
    cadastralNumber: "кадастровый номер",
    cadastralValue: "кадастровая стоимость",
    acquireDate: "дата приобретения",
  });
  mergeSection("medical", { ordinary: "лечение", expensive: "дорогостоящее лечение" });
  mergeSection("iis", { contribution: "взносы на ИИС" });
  mergeSection("insurance", { amount: "страхование жизни" });
  mergeSection("bank", { bik: "БИК", account: "номер счёта" });
  // Числовые реквизиты модель может вернуть с пробелами — приводим к цифрам,
  // как это делают поля ввода.
  if (draftPatch.bank)
    for (const f of ["bik", "account"])
      if (draftPatch.bank[f]) draftPatch.bank[f] = String(draftPatch.bank[f]).replace(/\D/g, "");
  if (draftPatch.personal)
    for (const f of ["ifns", "oktmo"])
      if (draftPatch.personal[f]) draftPatch.personal[f] = String(draftPatch.personal[f]).replace(/\D/g, "");

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
    const clean = foundIncomes.map((i) => ({
      name: String(i.name || "").trim(),
      inn: String(i.inn || "").replace(/\D/g, ""),
      kpp: String(i.kpp || "").replace(/\D/g, ""),
      oktmo: String(i.oktmo || "").replace(/\D/g, ""),
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
      const known = new Set(existing.map((i) => i.inn).filter(Boolean));
      const extra = clean.filter((i) => i.inn && !known.has(i.inn));
      if (extra.length) {
        draftPatch.incomes = [...existing, ...extra];
        applied.push(`доходы: +${extra.length} работодатель(я)`);
      }
    }
  }

  return { draftPatch, applied };
}
