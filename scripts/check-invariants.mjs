#!/usr/bin/env node
// Прогон расчётного ядра по большой матрице анкет с проверкой инвариантов.
//
//   npm run check:invariants
//
// Зачем отдельно от validate:xml. Схема ФНС проверяет ФОРМУ выгрузки; она
// молчит, если число посчитано неверно, но лежит в правильном теге. Здесь
// проверяется СМЫСЛ: не отрицательный ли возврат, не больше ли он удержанного
// налога, не превышен ли лимит, сходится ли база с доходом минус вычеты.
//
// Матрица собирается детерминированно (свой генератор псевдослучайных чисел,
// без Math.random) — прогон воспроизводим, и найденный дефект чинится по
// номеру сценария.
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

// Бланки импортируются как `?url` (так их отдаёт Vite), а в Node загрузчик
// превращает это в путь на диске. Подменяем fetch чтением файла — тот же приём,
// что в scripts/render-pdf.mjs. Без этого печать падает на первом же бланке.
globalThis.fetch = async (p) => {
  const buf = await readFile(p);
  return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

import { computeDeclaration } from "../src/lib/ndfl/calc.js";
import { buildDeclarationModel } from "../src/lib/ndfl/model.js";
import { buildDeclarationXml } from "../src/lib/ndfl/xml3ndfl.js";
import { buildDeclarationPdf } from "../src/lib/ndfl/pdf3ndfl.js";
import { YEARS, yearRules, SALE_YEARS, taxOn } from "../src/lib/ndfl/refs.js";

// --- детерминированный генератор -------------------------------------------
let seed = 20260911;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const TYPES = ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis",
               "strahovanie", "sport", "deti", "sberezheniya"];

const personal = {
  lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
  inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
  passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
  passportIssuer: "ОУФМС", phone: "+79120000000", oktmo: "75701000", ifns: "7447",
};

// Профили дохода: крайние случаи важнее средних.
const INCOMES = {
  "нет дохода": [],
  "ноль удержано": [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "500000", withheld: "0" }],
  "маленький": [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "100000", withheld: "13000" }],
  "обычный": [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "1200000", withheld: "156000" }],
  "высокий (прогрессия)": [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "5000000", withheld: String(taxOn(5000000, 2025)) }],
  "двое работодателей": [
    { name: "ООО «Ромашка»", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "800000", withheld: "104000" },
    { name: "ООО «Лютик»", inn: "7708503727", kpp: "770801001", oktmo: "45382000", income: "400000", withheld: "52000" },
  ],
  "удержано больше дохода": [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "100000", withheld: "200000" }],
};

const contracts = {
  iis: { brokerName: "АО «Брокер»", brokerInn: "7710140679", brokerKpp: "771001001",
         contractDate: "2023-02-10", contractNumber: "ИИС-1", openDate: "2023-02-12" },
  insurance: { insurerName: "ООО «СК»", insurerInn: "7702070139", insurerKpp: "770201001",
               contractDate: "2020-05-14", contractNumber: "Ж-1" },
};

function draftFor(year, types, incomeKey, extra = {}) {
  const kids = extra.kids ?? 0;
  return {
    year, types, personal, incomes: INCOMES[incomeKey],
    correction: extra.correction ?? 0,
    property: { objectKind: "flat", owner: "self", pensioner: Boolean(extra.pensioner),
                buildMethod: "bought", address: "г. Челябинск, ул. Ленина, 1",
                cadastral: "74:36:0000000:1", cost: extra.cost ?? "2500000",
                dateReg: `${year}-03-15`, dateAct: "",
                priorDeduction: extra.prior ?? "", interestPaid: "250000", priorInterest: "" },
    standard: {
      children: Array.from({ length: kids }, (_, i) => ({
        order: String(Math.min(3, i + 1)), disabled: extra.disabled && i === 0,
      })),
      singleParent: Boolean(extra.single),
      providedByAgent: extra.stdByAgent ?? "",
      months: "", monthly: extra.monthly ?? [],
    },
    socialProvided: { byAgent: extra.socByAgent ?? "", simplified: "" },
    medical: { ordinary: "60000", expensive: extra.expensive ?? "0" },
    education: { self: "40000", children: extra.eduKids ? [{ amount: "150000" }, { amount: "150000" }] : [] },
    iis: { contribution: "100000", newAccount: Boolean(extra.newIis), ...contracts.iis },
    insurance: { amount: "50000", ...contracts.insurance },
    sport: { amount: "30000" },
    savings: {
      contracts: [
        { kind: "npo", name: "НПФ", inn: "7725039953", kpp: "772501001", date: `${year}-01-15`, number: "Н-1", amount: extra.bigSavings ? "500000" : "60000" },
        { kind: "pds", name: "НПФ", inn: "7725039953", kpp: "772501001", date: `${year}-02-20`, number: "П-1", amount: "80000" },
      ],
      byAgent: "", simplified: "",
    },
    bank: { bik: "047501711", account: "40702810007710002545" },
    sales: extra.sales ?? [],
  };
}

// --- инварианты --------------------------------------------------------------
const problems = [];
const check = (id, cond, msg) => { if (!cond) problems.push(`${id}: ${msg}`); };
const finite = (v) => typeof v === "number" && Number.isFinite(v);

async function inspect(id, draft) {
  let c, model, xml;
  try {
    c = computeDeclaration(draft);
  } catch (e) {
    problems.push(`${id}: расчёт УПАЛ — ${e.message}`);
    return;
  }
  const r = yearRules(draft.year);

  // 1. Числа обязаны быть числами.
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "number")
      check(id, finite(v), `поле ${k} не число: ${v}`);
  }
  // 2. Ничего отрицательного там, где это бессмыслица.
  for (const k of ["totalIncome", "totalWithheld", "totalDeduction", "taxBase", "assessed", "refund"])
    check(id, c[k] >= 0, `${k} отрицательное: ${c[k]}`);

  // 3. База = доход минус вычеты, не ниже нуля.
  check(id, c.taxBase === Math.max(0, c.totalIncome - c.totalDeduction),
        `база ${c.taxBase} ≠ max(0, ${c.totalIncome} − ${c.totalDeduction})`);

  // 4. Возврат не больше удержанного налога — иначе ФНС вернёт чужие деньги.
  check(id, c.refund <= c.totalWithheld,
        `возврат ${c.refund} больше удержанного ${c.totalWithheld}`);

  // 5. Возврат — это ровно «удержано минус исчислено» (строка 160 Раздела 2 =
  //    080 − 150). Прежний инвариант «не больше 13% от вычетов» был подогнан
  //    под плоскую ставку и при прогрессивной шкале ложно срабатывал бы.
  check(id, c.refund === Math.max(0, c.totalWithheld - c.assessed),
        `возврат ${c.refund} ≠ удержано ${c.totalWithheld} − исчислено ${c.assessed}`);

  // 5б. Исчисленный налог считается по шкале года, а не плоскими 13%.
  check(id, c.assessed === taxOn(c.taxBase, draft.year, "main"),
        `исчислено ${c.assessed} ≠ по шкале ${taxOn(c.taxBase, draft.year, "main")}`);

  // 5в. Вычетов не может быть больше дохода — контрольное соотношение
  //     Раздела 2: строка 040 ≤ строка 030.
  check(id, c.totalDeduction <= c.totalIncome,
        `вычетов ${c.totalDeduction} больше дохода ${c.totalIncome}`);

  // 6. Социальная группа не выше годового лимита.
  check(id, c.applied.socialGroup <= r.socialGroup,
        `соцвычет ${c.applied.socialGroup} выше лимита ${r.socialGroup}`);

  // 7. Имущественные лимиты.
  check(id, c.applied.property <= 2_000_000, `имущественный ${c.applied.property} выше 2 млн`);
  check(id, c.applied.interest <= 3_000_000, `проценты ${c.applied.interest} выше 3 млн`);

  // 8. Стандартный вычет: месяцев не больше 12, заявленное не больше положенного.
  if (c.standard) {
    check(id, c.standard.months >= 0 && c.standard.months <= 12,
          `месяцев вычета на детей ${c.standard.months}`);
    check(id, c.standard.declared <= c.standard.eligible,
          `заявлено ${c.standard.declared} больше положенного ${c.standard.eligible}`);
  }
  // 9. Сбережения: группа пп. 1–3 не выше 400 000.
  if (c.savings) {
    const grp = c.savings.pds + c.savings.npo + c.savings.iis3;
    check(id, grp <= 400_000 + 1, `сбережения по пп.1–3 ${grp} выше 400 000`);
  }
  // 10. Продажа: налог неотрицательный, вычет не больше дохода.
  if (c.sale) {
    check(id, c.sale.tax >= 0, `налог с продажи отрицательный: ${c.sale.tax}`);
    // Объект, которым владели дольше минимального срока, не декларируется:
    // налога по нему быть не может.
    if (c.sale.items.every((o) => o.holdingExempt))
      check(id, c.sale.tax === 0, `все объекты освобождены, а налог ${c.sale.tax}`);
    check(id, c.sale.deduction <= c.sale.taxable + 1,
          `вычет с продажи ${c.sale.deduction} больше дохода ${c.sale.taxable}`);
  }
  // 11. Предупреждения — без ПДн и не пустые строки.
  for (const w of c.warnings || []) {
    check(id, typeof w === "string" && w.trim().length > 0, "пустое предупреждение");
    check(id, !/undefined|NaN|\[object/.test(w), `мусор в предупреждении: ${w.slice(0, 60)}`);
  }

  // 12. Модель и XML собираются и содержат те же деньги.
  try {
    model = buildDeclarationModel(draft);
  } catch (e) {
    problems.push(`${id}: модель УПАЛА — ${e.message}`);
    return;
  }
  try {
    xml = buildDeclarationXml(model);
  } catch (e) {
    problems.push(`${id}: XML УПАЛ — ${e.message}`);
    return;
  }
  const text = Buffer.from(xml.bytes).toString("latin1");
  check(id, text.includes("<?xml"), "XML без заголовка");
  check(id, !/NaN|undefined|Infinity/.test(text), "в XML попал NaN/undefined");
  // Печать. Ветка PDF не покрыта ничем другим: схема ФНС её не видит, а
  // check:wizard проходит только один сценарий. Здесь она прогоняется по всей
  // матрице — ищем падения и пустые/оборванные комплекты.
  try {
    const pdf = await buildDeclarationPdf(model);
    check(id, pdf && pdf.byteLength > 20000, `PDF подозрительно мал: ${pdf?.byteLength} байт`);
    // Страницы считаем разбором документа, а не регуляркой по байтам: pdf-lib
    // пишет объекты в сжатых потоках, и текстовый поиск даёт ноль.
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    check(id, pages >= 4, `в комплекте всего ${pages} страниц — не хватает листов`);
    // Приложение 5 обязано физически присутствовать, когда на нём есть данные.
    if (model.needsApp5)
      check(id, pages >= 6, `needsApp5, но страниц ${pages} — Приложения 5 в PDF нет`);
  } catch (e) {
    problems.push(`${id}: PDF УПАЛ — ${e.message}`);
  }

  // Лист Приложения 5 обязан быть, если на нём есть что печатать.
  if (model.needsApp5) {
    const tag = [..."ВычСтандСоц"].map((ch) => {
      const cp = ch.codePointAt(0);
      return cp < 0x80 ? ch : String.fromCharCode(cp - 0x410 + 0xc0);
    }).join("");
    check(id, text.includes(tag), "needsApp5, но элемента ВычСтандСоц в XML нет");
  }
}

// --- матрица -----------------------------------------------------------------
let n = 0;
const jobs = [];
const run = (name, draft) => { jobs.push(inspect(`#${++n} ${name}`, draft)); };

// 1. Каждый вычет по отдельности × каждый год × каждый профиль дохода.
for (const year of YEARS)
  for (const t of TYPES)
    for (const ik of Object.keys(INCOMES))
      run(`${year} ${t} / ${ik}`, draftFor(year, [t], ik));

// 2. Все вычеты сразу.
for (const year of YEARS)
  for (const ik of Object.keys(INCOMES))
    run(`${year} все вычеты / ${ik}`, draftFor(year, TYPES, ik));

// 3. Крайние случаи детского вычета.
for (const year of YEARS)
  for (const kids of [1, 2, 3, 5])
    for (const flags of [{}, { disabled: true }, { single: true }, { disabled: true, single: true },
                         { stdByAgent: "100000" }])
      run(`${year} детей ${kids} ${JSON.stringify(flags)}`,
          draftFor(year, ["deti"], "обычный", { kids, ...flags }));

// 4. Помесячный доход: ровный, с премией, неполный год, с нулями.
for (const [label, monthly] of [
  ["ровный", Array(12).fill("100000")],
  ["премия в декабре", [...Array(11).fill("45455"), "445455"]],
  ["полгода", [...Array(6).fill("200000"), ...Array(6).fill("0")]],
  ["всё в январе", ["1200000", ...Array(11).fill("0")]],
])
  run(`2025 месяцы: ${label}`, draftFor(2025, ["deti"], "обычный", { kids: 2, monthly }));

// 5. Превышение лимитов.
run("соцвычет сверх лимита", draftFor(2025, ["lechenie", "obuchenie", "sport", "strahovanie"], "обычный", { expensive: "900000" }));
run("обучение двух детей по 150k", draftFor(2025, ["obuchenie"], "обычный", { eduKids: true }));
run("сбережения сверх 400k", draftFor(2025, ["sberezheniya"], "обычный", { bigSavings: true }));
run("жильё дороже лимита", draftFor(2025, ["kvartira", "ipoteka"], "обычный", { cost: "9000000" }));
run("вычет уже использован", draftFor(2025, ["kvartira"], "обычный", { prior: "2000000" }));
run("пенсионер, старый год", draftFor(2022, ["kvartira"], "обычный", { pensioner: true }));
run("ИИС с 2024 (219.2)", draftFor(2025, ["iis"], "обычный", { newIis: true }));
run("уточнённая", draftFor(2025, TYPES, "обычный", { correction: 2 }));

// 6. Продажа и смешанные.
const auto = { kind: "auto", price: "600000", saleDate: "2025-06-10", deductionKind: "standard",
               buyerName: "Петров Пётр", buyerInn: "" };
const flat = { kind: "realty", objectKind: "flat", cadastralNumber: "74:36:0000000:1",
               cadastralValue: "9000000", price: "3000000", saleDate: "2025-06-10",
               acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "standard",
               buyerName: "Петров Пётр", buyerInn: "" };
for (const year of SALE_YEARS) {
  const fix = (s) => ({ ...s, saleDate: `${year}-06-10` });
  run(`${year} продажа авто`, draftFor(year, ["prodazha_auto"], "нет дохода", { sales: [fix(auto)] }));
  run(`${year} продажа квартиры`, draftFor(year, ["prodazha_realty"], "нет дохода", { sales: [fix(flat)] }));
  run(`${year} четыре объекта`, draftFor(year, ["prodazha_auto", "prodazha_realty"], "нет дохода",
      { sales: [fix(auto), fix({ ...auto, price: "500000" }), fix(flat), fix({ ...flat, objectKind: "garage", cadastralValue: "600000", price: "800000" })] }));
}
run("2025 смешанная: вычеты + продажа", draftFor(2025, [...TYPES, "prodazha_auto"], "обычный", { sales: [auto] }));

// 7. Случайные сочетания — то, о чём не подумали.
for (let i = 0; i < 200; i++) {
  const year = pick(YEARS);
  const types = TYPES.filter(() => rnd() < 0.45);
  if (!types.length) continue;
  run(`случайный ${i}: ${year} ${types.join("+")}`,
      draftFor(year, types, pick(Object.keys(INCOMES)),
               { kids: Math.floor(rnd() * 4), disabled: rnd() < 0.3, single: rnd() < 0.2 }));
}

await Promise.all(jobs);
console.log(`Проверено сценариев: ${n}`);
if (problems.length) {
  console.log(`\nНАРУШЕНИЙ ИНВАРИАНТОВ: ${problems.length}\n`);
  for (const p of problems.slice(0, 40)) console.log("  ✗ " + p);
  if (problems.length > 40) console.log(`  … и ещё ${problems.length - 40}`);
  process.exit(1);
}
console.log("Все инварианты соблюдены.");
