// Офлайн-рендер декларации в PDF для попиксельной сверки бланков.
// Запуск: node --loader ./scripts/_url-loader.mjs scripts/render-pdf.mjs <out.pdf> <scenario>
// scenario: realty2025 | realty2024 | realty2023 | auto2025 | refund2025 ...
import { readFile, writeFile } from "node:fs/promises";

// Vite ?url отдаёт абсолютный путь; loadAsset делает fetch(path).arrayBuffer().
globalThis.fetch = async (p) => {
  const buf = await readFile(p);
  return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

const { buildDeclarationModel } = await import("../src/lib/ndfl/model.js");
const { buildOfficialPdf2025 } = await import("../src/lib/ndfl/blank2025.js");
const { buildOfficialPdfLegacy } = await import("../src/lib/ndfl/blankLegacy.js");

const person = {
  lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
  inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
  passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
  passportIssuer: "ОУФМС России по Челябинской обл.", phone: "+7 (912) 000-00-00",
  oktmo: "75701000", ifns: "7447",
};

const realtySale = (byCadastral) => ({
  kind: "realty", objectKind: "flat",
  cadastralNumber: "74:36:0000000:1234", cadastralValue: "9000000",
  price: byCadastral ? "3000000" : "8000000", // кадастр×0,7=6.3млн
  saleDate: "YEAR-06-10", acquireDate: "2023-01-10", realtyBasis: "purchase",
  deductionKind: "standard", buyerName: "Петров Пётр Петрович", buyerInn: "",
});

const drafts = {
  realty2025: { year: 2025, types: ["prodazha_realty"], incomes: [], sale: realtySale(true) },
  realty2024: { year: 2024, types: ["prodazha_realty"], incomes: [], sale: realtySale(true) },
  realty2023: { year: 2023, types: ["prodazha_realty"], incomes: [], sale: realtySale(true) },
  auto2025: { year: 2025, types: ["prodazha_auto"], incomes: [], sale: { kind: "auto", price: "600000", saleDate: "2025-06-10", deductionKind: "standard", buyerName: "Петров Пётр Петрович", buyerInn: "" } },
};

const [out, scenario] = process.argv.slice(2);
const draft = drafts[scenario];
if (!draft) { console.error("scenario?", Object.keys(drafts)); process.exit(1); }
draft.personal = person;
if (draft.sale?.saleDate) draft.sale.saleDate = draft.sale.saleDate.replace("YEAR", String(draft.year));

const model = buildDeclarationModel(draft);
const bytes = draft.year >= 2025 ? await buildOfficialPdf2025(model) : await buildOfficialPdfLegacy(model);
await writeFile(out, bytes);
console.log("написал", out, "листов:", model.sale ? "продажа" : "возврат");
