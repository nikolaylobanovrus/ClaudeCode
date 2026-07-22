// Автозаполнение анкеты из документов: подготовка файлов, вызов Edge
// Function parse-documents и аккуратное слияние результата в черновик.
// Файлы уходят на сервер распознавания и НЕ сохраняются (см. дисклеймер
// в DocAutofill и docs/anthropic-setup.md).
import { supabase as cfg } from "../data/content.js";

export const MAX_FILES = 10;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
// Фото даунскейлится до этого размера по длинной стороне: выше рабочего
// разрешения модели, поэтому на качество распознавания не влияет, а вес
// снимка с телефона падает с ~8 МБ до сотен КБ.
const IMAGE_MAX_SIDE = 2000;
const JPEG_QUALITY = 0.82;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class DocParseError extends Error {}

// Фото → сжатый JPEG через canvas. Заодно конвертирует HEIC/HEIF, если
// браузер умеет их декодировать (Safari умеет). PDF возвращается как есть.
async function prepareFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES)
      throw new DocParseError(`«${file.name}»: PDF больше 15 МБ — сожмите или разбейте на части`);
    return { name: file.name, mediaType: "application/pdf", blob: file };
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
    throw new DocParseError("файлы слишком большие даже после сжатия — разбейте на два захода");

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

  let res;
  try {
    res = await fetch(`${cfg.url}/functions/v1/parse-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: JSON.stringify(payload),
      // 150 с — под потолок edge-функции Supabase (~150 с wall-clock). Выше
      // ставить смысла нет: сервер завершится раньше. Партия из 8–10 фото
      // объективно долгая, поэтому подсказка в UI советует грузить по 3–5.
      signal: AbortSignal.timeout(150_000),
    });
  } catch (e) {
    throw new DocParseError(
      e?.name === "TimeoutError"
        ? "распознавание идёт дольше обычного — загрузите меньше файлов за раз (по 3–5) и повторите"
        : "нет связи с сервисом распознавания — проверьте интернет"
    );
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.patch)
    throw new DocParseError(data?.error || "не получилось распознать документы");
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
  });
  mergeSection("medical", { ordinary: "лечение", expensive: "дорогостоящее лечение" });
  mergeSection("iis", { contribution: "взносы на ИИС" });
  mergeSection("insurance", { amount: "страхование жизни" });

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
