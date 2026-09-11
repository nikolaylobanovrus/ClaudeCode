#!/usr/bin/env node
// Сверка: печатный комплект и XML обязаны говорить одно и то же.
//
//   npm run check:consistency
//
// Зачем. Расчёт, печать и выгрузка — три разных куска кода, которые читают
// одну модель. Схема ФНС проверяет только XML, глазами сверяют только PDF, и
// расхождение между ними не ловит никто. А для человека это худший случай:
// на бумаге одна сумма, в личном кабинете другая, и камеральная проверка
// упирается в разночтение, которого он не совершал.
//
// Проверяем, что КАЖДАЯ ненулевая сумма из расчёта физически присутствует и в
// тексте PDF, и в XML. Нужен pdftotext (пакет poppler-utils).
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

globalThis.fetch = async (p) => {
  const buf = await readFile(p);
  return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

const { computeDeclaration } = await import("../src/lib/ndfl/calc.js");
const { buildDeclarationModel } = await import("../src/lib/ndfl/model.js");
const { buildDeclarationXml } = await import("../src/lib/ndfl/xml3ndfl.js");
const { buildDeclarationPdf } = await import("../src/lib/ndfl/pdf3ndfl.js");
const { computeSaleTax } = await import("../src/lib/ndfl/saleTax.js");

const personal = {
  lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
  inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
  passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
  passportIssuer: "ОУФМС", phone: "+79120000000", oktmo: "75701000", ifns: "7447",
};
const income = [{ name: "ООО «Ромашка»", inn: "7420010847", kpp: "741501001",
                  oktmo: "75701000", income: "1500000", withheld: "195000" }];
const iis = { contribution: "100000", brokerName: "АО «Брокер»", brokerInn: "7710140679",
              brokerKpp: "771001001", contractDate: "2023-02-10", contractNumber: "ИИС-1",
              openDate: "2023-02-12" };
const insurance = { amount: "50000", insurerName: "ООО «СК»", insurerInn: "7702070139",
                    insurerKpp: "770201001", contractDate: "2020-05-14", contractNumber: "Ж-1" };
const savings = { contracts: [
  { kind: "npo", name: "НПФ", inn: "7725039953", kpp: "772501001", date: "2025-01-15", number: "Н-1", amount: "60000" },
  { kind: "pds", name: "НПФ", inn: "7725039953", kpp: "772501001", date: "2025-02-20", number: "П-1", amount: "80000" },
], byAgent: "", simplified: "" };

const base = (year, types, extra = {}) => ({
  year, types, personal, incomes: income, correction: 0,
  property: { objectKind: "flat", owner: "self", pensioner: false, buildMethod: "bought",
              address: "г. Челябинск, ул. Ленина, 1", cadastral: "74:36:0000000:1",
              cost: "2500000", dateReg: `${year}-03-15`, dateAct: "",
              priorDeduction: "", interestPaid: "250000", priorInterest: "" },
  standard: { children: [{ order: "1", disabled: false }, { order: "2", disabled: true }],
              singleParent: false, providedByAgent: "", months: "", monthly: [] },
  socialProvided: { byAgent: "", simplified: "" },
  medical: { ordinary: "60000", expensive: "150000" },
  education: { self: "40000", children: [{ amount: "50000" }] },
  iis, insurance, sport: { amount: "30000" }, savings,
  bank: { bik: "047501711", account: "40702810007710002545" },
  sales: [], ...extra,
});

const SCENARIOS = [
  ["2025 лечение", base(2025, ["lechenie"])],
  ["2025 обучение", base(2025, ["obuchenie"])],
  ["2025 жильё и ипотека", base(2025, ["kvartira", "ipoteka"])],
  ["2025 ИИС", base(2025, ["iis"])],
  ["2025 страхование", base(2025, ["strahovanie"])],
  ["2025 спорт", base(2025, ["sport"])],
  ["2025 дети", base(2025, ["deti"])],
  ["2025 сбережения", base(2025, ["sberezheniya"])],
  ["2025 вычет уже дал работодатель", base(2025, ["lechenie", "obuchenie", "deti"],
    { socialProvided: { byAgent: "20000", simplified: "10000" } })],
  ["2025 всё сразу", base(2025, ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis",
                                 "strahovanie", "sport", "deti", "sberezheniya"])],
  ["2024 всё сразу", base(2024, ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis",
                                 "strahovanie", "sport", "deti"])],
  ["2023 всё сразу", base(2023, ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis",
                                 "strahovanie", "sport", "deti"])],
  ["2022 всё сразу", base(2022, ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis",
                                 "strahovanie", "sport", "deti"])],
];

// Смешанная декларация: продал машину И заявил вычеты. Худший случай для
// сборки листов — обе половины обязаны быть на бумаге разом, иначе человек
// подаёт в налоговую документ, где про оплаченное лечение не сказано ни
// строчки. На бланке 2025 года это работает; за старые годы такая декларация
// невозможна по арифметике (одна налоговая база на зарплату и продажу), и
// проверка ниже требует, чтобы сборка отказывалась вслух, а не печатала
// половину.
const mixedDraft = (year) =>
  base(year, ["lechenie", "obuchenie", "deti", "prodazha_auto"], {
    sales: [{ kind: "auto", price: "600000", saleDate: `${year}-06-10`,
              deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" }],
  });
SCENARIOS.push(["2025 смешанная: вычеты + продажа авто", mixedDraft(2025)]);

// Цифры в бланке стоят по клеткам, поэтому из текста PDF они выходят с
// пробелами между знаками. Больше того, разделительная ТОЧКА напечатана на
// самом бланке: на векторных листах она попадает в текстовый слой, а на
// листах, взятых из шаблона растром (Приложение 5, лист 2), её там нет.
// Поэтому сравниваем только цифры: 60 000 ищется как «6000000».
const digitsOnly = (s) => s.replace(/\D/g, "");
const kop = (n) => `${Math.round(n)}00`;

const dir = await mkdtemp(join(tmpdir(), "ndfl-cons-"));
let problems = 0;

for (const [name, draft] of SCENARIOS) {
  const calc = computeDeclaration(draft);
  const model = buildDeclarationModel(draft);
  const xmlText = digitsOnly(Buffer.from(buildDeclarationXml(model).bytes).toString("latin1"));
  const pdfPath = join(dir, name.replace(/\W+/g, "_") + ".pdf");
  await writeFile(pdfPath, await buildDeclarationPdf(model));
  const pdfText = digitsOnly(execFileSync("pdftotext", ["-layout", pdfPath, "-"]).toString());

  // Что именно обязано быть видно в обоих документах.
  const want = {
    "общий доход": calc.totalIncome,
    "сумма вычетов": calc.totalDeduction,
    "налоговая база": calc.taxBase,
    "лечение обычное": calc.lines.medicalOrdinary,
    "лечение дорогостоящее": calc.applied.expensiveMedical,
    "обучение своё": calc.lines.educationSelf,
    "обучение детей": calc.applied.childEducation,
    "страхование жизни": calc.lines.insurance,
    "спорт": calc.lines.sport,
    "ИИС": calc.applied.iis,
    "имущественный": calc.applied.property,
    "проценты по ипотеке": calc.applied.interest,
    "вычет на детей": calc.standard?.declared,
    "предоставлено агентом (181)": calc.socialProvided?.byAgent,
    "упрощённый порядок (182)": calc.socialProvided?.simplified,
    "сбережения к заявлению": calc.savings?.declared,
  };

  // Налоги печатаются в полных рублях, без копеек, — искать их надо иначе.
  const wantInt = {
    "исчисленный налог": calc.assessed,
    "удержанный налог": calc.totalWithheld,
    "налог к возврату": calc.refund,
    "налог с продажи": calc.sale?.tax,
    "налог к уплате": calc.owed,
  };

  const miss = [];
  for (const [label, value] of Object.entries(wantInt)) {
    if (!value || value <= 0) continue;
    const s = String(Math.round(value));
    const inPdf = pdfText.includes(s);
    const inXml = xmlText.includes(s);
    if (!inPdf || !inXml)
      miss.push(`${label} ${s}: ${!inPdf ? "нет в PDF" : ""}${!inPdf && !inXml ? " и " : ""}${!inXml ? "нет в XML" : ""}`);
  }
  for (const [label, value] of Object.entries(want)) {
    if (!value || value <= 0) continue;
    const s = kop(value);
    const inPdf = pdfText.includes(s);
    const inXml = xmlText.includes(s);
    if (!inPdf || !inXml)
      miss.push(`${label} ${s}: ${!inPdf ? "нет в PDF" : ""}${!inPdf && !inXml ? " и " : ""}${!inXml ? "нет в XML" : ""}`);
  }
  if (miss.length) {
    problems += miss.length;
    console.log(`✗ ${name}`);
    for (const m of miss) console.log("    " + m);
  } else {
    console.log(`✓ ${name}: печать и выгрузка сходятся`);
  }
}

// --- Старые годы: половина декларации хуже отказа --------------------------
console.log("\n--- комбинированная декларация за старые годы ---");
for (const year of [2023, 2024]) {
  let printed = null, threw = "";
  try {
    printed = await buildDeclarationPdf(buildDeclarationModel(mixedDraft(year)));
  } catch (e) {
    threw = e.message;
  }
  const ok = !printed && /продажу и вычет/.test(threw);
  if (!ok) problems++;
  console.log(ok
    ? `✓ ${year}: сборка отказывается вслух, а не печатает половину`
    : `✗ ${year}: ${printed ? "напечатала комплект" : "упала не тем: " + threw}`);
}

// --- Калькулятор на лендинге и декларация обязаны давать один налог --------
// Это два независимых движка: saleTax.js питает публичный калькулятор, calc.js
// строит документ. Человек считает налог ДО оплаты и видит сумму ПОСЛЕ — если
// они разойдутся, это худший момент для сюрприза. Уже расходились дважды: по
// освобождению от налога при долгом владении и по ставке свыше 2,4 млн.
console.log("\n--- калькулятор на сайте против декларации ---");
const SALES = [
  ["квартира 9 млн, владение 2 года", { objectKind: "flat", price: "9000000", cadastralValue: "9000000", acquireDate: "2023-01-10" }],
  ["квартира 3 млн, владение 2 года", { objectKind: "flat", price: "3000000", cadastralValue: "2000000", acquireDate: "2023-01-10" }],
  ["квартира 8 млн, владение 15 лет", { objectKind: "flat", price: "8000000", cadastralValue: "8000000", acquireDate: "2010-01-10" }],
  ["гараж 800 тыс, владение 2 года", { objectKind: "garage", price: "800000", cadastralValue: "600000", acquireDate: "2023-01-10" }],
];
for (const [label, o] of SALES) {
  const common = { kind: "realty", saleDate: "2025-06-10", realtyBasis: "purchase",
                   deductionKind: "standard", ...o };
  const fromCalculator = computeSaleTax(common).tax;
  const fromDeclaration = computeDeclaration({
    year: 2025, types: ["prodazha_realty"], personal, incomes: [],
    sales: [{ ...common, cadastralNumber: "74:36:0000000:1", buyerName: "Петров" }],
  }).owed;
  const ok = fromCalculator === fromDeclaration;
  if (!ok) problems++;
  console.log(`${ok ? "✓" : "✗"} ${label}: калькулятор ${fromCalculator} ₽, декларация ${fromDeclaration} ₽`);
}

console.log(problems ? `\nРАСХОЖДЕНИЙ: ${problems}` : "\nВсё сходится: печать, выгрузка и калькулятор.");
process.exit(problems ? 1 : 0);
