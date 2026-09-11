// Генерация тестовых XML во временную папку — вход для schematron-проверки
// (npm run validate:sch). Пути импортов относительные, ассеты не нужны.
// Генерация всех тестовых XML (сценарии validate-3ndfl-xml + продажи) в файлы.
import { writeFileSync, mkdirSync } from "node:fs";
import { buildDeclarationXml } from "../src/lib/ndfl/xml3ndfl.js";
import { buildDeclarationModel } from "../src/lib/ndfl/model.js";
import { YEARS, SALE_YEARS, MIXED_YEARS } from "../src/lib/ndfl/refs.js";
const personal = {
  lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
  inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
  passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
  passportIssuer: "ОУФМС", phone: "+7 (912) 000-00-00", oktmo: "75701000", ifns: "7447",
};
const base = (year) => ({
  // Набор должен покрывать ВСЕ вычеты, которые умеет мастер: контрольные
  // соотношения ФНС проверяют арифметику между листами, и вычет, которого нет
  // в черновике, не проверяется вообще (схема на отсутствие элемента молчит).
  year, types: ["kvartira","ipoteka","lechenie","obuchenie","iis","strahovanie","sport","deti","sberezheniya"], personal,
  incomes: [
    { name: "ООО «Ромашка»", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "1200000", withheld: "156000" },
    { name: "ООО «Лютик»", inn: "7708503727", kpp: "770801001", oktmo: "45382000", income: "300000", withheld: "39000" },
  ],
  property: { address: "г. Челябинск, ул. Ленина, 1", cadastral: "74:36:0000000:1234", cost: "2500000", dateAct: "", dateReg: "2024-03-15", priorDeduction: "", interestPaid: "250000", priorInterest: "" },
  medical: { ordinary: "60000", expensive: "10000" }, education: { self: "40000", children: [{ amount: "50000" }] },
  iis: {
    contribution: "100000",
    brokerName: "АО «Брокер»", brokerInn: "7710140679", brokerKpp: "771001001",
    contractDate: "2023-02-10", contractNumber: "ИИС-1", openDate: "2023-02-12",
  },
  insurance: {
    amount: "5000",
    insurerName: "ООО «СК Жизнь»", insurerInn: "7702070139", insurerKpp: "770201001",
    contractDate: "2020-05-14", contractNumber: "Ж-1",
  },
  sport: { amount: "30000" },
  standard: { children: [{ order: "1", disabled: false }, { order: "2", disabled: true }],
              singleParent: false, providedByAgent: "8000", months: "4" },
  socialProvided: { byAgent: "5000", simplified: "3000" },
  savings: {
    contracts: [
      { kind: "npo", name: "НПФ «Будущее»", inn: "7725039953", kpp: "772501001",
        date: "2025-01-15", number: "НПО-1", amount: "60000" },
      { kind: "pds", name: "НПФ «Будущее»", inn: "7725039953", kpp: "772501001",
        date: "2025-02-20", number: "ПДС-1", amount: "80000" },
      { kind: "life10", name: "ООО «СК Жизнь»", inn: "7702070139", kpp: "770201001",
        date: "2025-03-05", number: "ЖС-1", amount: "40000" },
    ],
    byAgent: "10000", simplified: "5000",
  },
  bank: { bik: "047501711", account: "40702810007710002545" }, order: null,
});
const out = process.argv[2];
// Папку создаём сами: без этого скрипт падал на первом writeFileSync, а с ним
// и `npm run validate:sch` — то есть контрольные соотношения ФНС не
// проверялись вообще, молча.
mkdirSync(out, { recursive: true });
for (const year of YEARS) {
  const { filename, bytes } = buildDeclarationXml(buildDeclarationModel(base(year)));
  writeFileSync(`${out}/refund-${year}.xml`, bytes);
  // Вид объекта обязан варьироваться: контрольное соотношение ФНС требует
  // «способ приобретения» при одних кодах объекта и ЗАПРЕЩАЕТ при других, а
  // «жилой дом с участком» в форме 2024 имеет свой код. Пока во всех
  // сценариях стояла квартира, эта ветка не проверялась ничем — и файл с
  // домом за 2024 год ЛК ФНС отвергал.
  for (const [tag, objectKind] of [["house", "house"], ["houseland", "houseLand"],
                                   ["room", "room"], ["land", "land"]]) {
    const d = base(year);
    d.property = { ...d.property, objectKind, buildMethod: "new" };
    writeFileSync(`${out}/prop-${tag}-${year}.xml`,
                  buildDeclarationXml(buildDeclarationModel(d)).bytes);
  }
  if (SALE_YEARS.includes(year)) {
    for (const [tag, sale] of [
      ["auto", { kind: "auto", price: "600000", saleDate: `${year}-06-10`, deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" }],
      ["realty", { kind: "realty", objectKind: "flat", cadastralNumber: "74:36:0000000:1234", cadastralValue: "9000000", price: "3000000", saleDate: `${year}-06-10`, acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" }],
    ]) {
      const d = { year, types: [sale.kind === "realty" ? "prodazha_realty" : "prodazha_auto"], personal, incomes: [], sale };
      const { bytes: b } = buildDeclarationXml(buildDeclarationModel(d));
      writeFileSync(`${out}/sale-${tag}-${year}.xml`, b);
      // Комбинированная декларация (продажа + вычеты) — только за годы, где
      // форма разводит налоговые базы: в ней два блока Раздела 1, две НалБаза
      // и оба источника дохода, и всё это должно пройти форматный контроль.
      if (MIXED_YEARS.includes(year)) {
        const m = { ...base(year), types: [...base(year).types, sale.kind === "realty" ? "prodazha_realty" : "prodazha_auto"], sale };
        const { bytes: mb } = buildDeclarationXml(buildDeclarationModel(m));
        writeFileSync(`${out}/mixed-${tag}-${year}.xml`, mb);
      }
    }
  }
}
// Несколько объектов за год — общий годовой лимит вычета и по источнику
// дохода на каждый объект.
for (const year of SALE_YEARS) {
  const sales = [
    { kind: "auto", price: "400000", saleDate: `${year}-03-01`, deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" },
    { kind: "auto", price: "500000", saleDate: `${year}-05-01`, deductionKind: "expenses", expenses: "450000", buyerName: "Сидоров Иван", buyerInn: "" },
    { kind: "realty", objectKind: "flat", cadastralNumber: "74:36:0000000:1", cadastralValue: "5000000", price: "3000000", saleDate: `${year}-07-01`, acquireDate: "2022-01-10", realtyBasis: "purchase", deductionKind: "standard", buyerName: "Кузнецова Анна", buyerInn: "" },
    { kind: "realty", objectKind: "garage", cadastralNumber: "74:36:0000000:2", cadastralValue: "600000", price: "800000", saleDate: `${year}-08-01`, acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "standard", buyerName: "Кузнецова Анна", buyerInn: "" },
  ];
  const d = { year, types: ["prodazha_auto", "prodazha_realty"], personal, incomes: [], sales };
  const { bytes } = buildDeclarationXml(buildDeclarationModel(d));
  writeFileSync(`${out}/multi-sale-${year}.xml`, bytes);
}
console.log("XML сгенерированы");
