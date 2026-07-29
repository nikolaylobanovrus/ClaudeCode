// Офлайн-проверка XML-декларации против официальных XSD-схем ФНС.
// Схемы кладут в docs/fns-schemas/3ndfl-<год>.xsd (см. README там же).
// Запуск: npm run validate:xml
//
// Скрипт генерирует тестовую декларацию за каждый год ТЕМ ЖЕ кодом, что и
// сайт (src/lib/ndfl/xml3ndfl.js), и валидирует её через `xmllint --schema`.
// Годы без схемы пропускаются с явным сообщением.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeclarationXml } from "../src/lib/ndfl/xml3ndfl.js";
import { buildDeclarationModel } from "../src/lib/ndfl/model.js";
import { YEARS, SALE_YEARS } from "../src/lib/ndfl/refs.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaDir = join(root, "docs", "fns-schemas");

// Полный черновик со всеми вычетами — чтобы в XML появились все листы
// (Приложения 1, 5, 7), которые должна покрыть схема.
const sampleDraft = (year) => ({
  year,
  types: ["kvartira", "ipoteka", "lechenie", "obuchenie", "iis", "strahovanie"],
  personal: {
    lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
    inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
    passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
    passportIssuer: "ОУФМС России по Челябинской обл.", phone: "+7 (912) 000-00-00",
    oktmo: "75701000", ifns: "7447",
  },
  incomes: [
    { name: "ООО «Ромашка»", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "1200000", withheld: "156000" },
  ],
  property: { address: "г. Челябинск, ул. Ленина, д. 1, кв. 2", cadastral: "74:36:0000000:1234", cost: "2500000", dateAct: "", dateReg: "2024-03-15", priorDeduction: "", interestPaid: "250000", priorInterest: "" },
  medical: { ordinary: "60000", expensive: "0" },
  education: { self: "40000", children: [{ amount: "50000" }] },
  iis: { contribution: "100000" },
  insurance: { amount: "0" },
  bank: { bik: "047501711", account: "40702810007710002545" },
  order: null,
});

function checkXmllint() {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!checkXmllint()) {
  console.error("✗ Не найден xmllint (пакет libxml2-utils). Установите его и повторите.");
  process.exit(2);
}

// Вариации Приложения 7: квартира-собственник (по умолчанию) и жилой дом
// с участком у супруга-пенсионера — покрывают КодНаимОб, ПризнакНП
// (пенсионные коды) и СпособПриобр.
const scenarios = [
  { tag: "квартира", patch: {} },
  {
    tag: "дом, супруг-пенсионер",
    patch: { objectKind: "houseLand", owner: "spouse", pensioner: true, buildMethod: "new" },
  },
  // Уточнённая декларация: НомКорр="1" на титуле (остальное идентично).
  { tag: "квартира, уточнёнка (НомКорр=1)", patch: {}, correction: 1 },
];

// Продажа имущества (Приложение 6, налог к уплате): проверяем для лет из
// SALE_YEARS. Черновик без зарплаты и вычетов — чистая продажа авто.
const saleScenarios = [
  { tag: "продажа авто, вычет 250к", sale: { kind: "auto", price: "600000", deductionKind: "standard", buyerName: "Петров Пётр Петрович", buyerInn: "" } },
  { tag: "продажа авто, расходы", sale: { kind: "auto", price: "600000", deductionKind: "expenses", expenses: "550000", buyerName: "Петров Пётр Петрович", buyerInn: "500100732259" } },
  // Недвижимость: (1) доход по цене договора (договор ≥ кадастр × 0,7),
  // (2) доход по кадастру (кадастр × 0,7 > договор) — разные коды Прил. 1.
  { tag: "продажа квартиры, доход по договору", sale: { kind: "realty", objectKind: "flat", cadastralNumber: "74:36:0000000:1234", cadastralValue: "3000000", price: "4000000", saleDate: `${2025}-06-10`, acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "standard", buyerName: "Петров Пётр Петрович", buyerInn: "" } },
  { tag: "продажа дома, доход по кадастру", sale: { kind: "realty", objectKind: "house", cadastralNumber: "74:36:0000000:5678", cadastralValue: "8000000", price: "3000000", saleDate: `${2025}-06-10`, acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "expenses", expenses: "2000000", buyerName: "Петров Пётр Петрович", buyerInn: "500100732259" } },
];
const saleDraft = (year, sale) => ({
  year,
  types: [sale.kind === "realty" ? "prodazha_realty" : "prodazha_auto"],
  personal: sampleDraft(year).personal,
  incomes: [],
  // saleDate завязан на отчётный год — подставляем текущий год сценария.
  sale: { ...sale, saleDate: sale.saleDate ? `${year}-06-10` : sale.saleDate },
});

const tmp = mkdtempSync(join(tmpdir(), "ndfl-xml-"));
let anySchema = false;
let failed = 0;

for (const year of [...YEARS].sort((a, b) => a - b)) {
  const schema = join(schemaDir, `3ndfl-${year}.xsd`);
  if (!existsSync(schema)) {
    console.log(`• ${year}: схема не найдена (docs/fns-schemas/3ndfl-${year}.xsd) — пропуск`);
    continue;
  }
  anySchema = true;
  for (const sc of scenarios) {
    const draft = sampleDraft(year);
    Object.assign(draft.property, sc.patch);
    if (sc.correction) draft.correction = sc.correction;
    const model = buildDeclarationModel(draft);
    const { filename, bytes } = buildDeclarationXml(model);
    const xmlPath = join(tmp, `${scenarios.indexOf(sc)}-${filename}`);
    writeFileSync(xmlPath, bytes); // байты в windows-1251, как для ЛК ФНС
    try {
      execFileSync("xmllint", ["--noout", "--schema", schema, xmlPath], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      console.log(`✓ ${year} (${sc.tag}): OK — XML соответствует схеме ФНС`);
    } catch (e) {
      failed++;
      console.log(`✗ ${year} (${sc.tag}): XML НЕ прошёл схему:`);
      console.log(String(e.stderr || e.message).trim().split("\n").map((l) => "    " + l).join("\n"));
    }
  }
  if (SALE_YEARS.includes(year)) {
    for (const [i, sc] of saleScenarios.entries()) {
      const model = buildDeclarationModel(saleDraft(year, sc.sale));
      const { filename, bytes } = buildDeclarationXml(model);
      const xmlPath = join(tmp, `s${i}-${filename}`);
      writeFileSync(xmlPath, bytes);
      try {
        execFileSync("xmllint", ["--noout", "--schema", schema, xmlPath], {
          stdio: ["ignore", "ignore", "pipe"],
        });
        console.log(`✓ ${year} (${sc.tag}): OK — XML соответствует схеме ФНС`);
      } catch (e) {
        failed++;
        console.log(`✗ ${year} (${sc.tag}): XML НЕ прошёл схему:`);
        console.log(String(e.stderr || e.message).trim().split("\n").map((l) => "    " + l).join("\n"));
      }
    }
  }
}

rmSync(tmp, { recursive: true, force: true });

if (!anySchema) {
  console.log(
    "\nНи одной XSD-схемы нет — положите их в docs/fns-schemas/ (см. README там же)."
  );
  console.log("Проверять нечего; XML остаётся в статусе «бета».");
  process.exit(0);
}
if (failed) {
  console.log(`\nНе прошло проверку годов: ${failed}. XML остаётся «бета» до исправления.`);
  process.exit(1);
}
console.log("\nВсе доступные годы прошли схему ФНС. Можно снять «бета» (см. docs/fns-schemas/README.md).");
