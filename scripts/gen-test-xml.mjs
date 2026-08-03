// Генерация тестовых XML во временную папку — вход для schematron-проверки
// (npm run validate:sch). Пути импортов относительные, ассеты не нужны.
// Генерация всех тестовых XML (сценарии validate-3ndfl-xml + продажи) в файлы.
import { writeFileSync } from "node:fs";
import { buildDeclarationXml } from "../src/lib/ndfl/xml3ndfl.js";
import { buildDeclarationModel } from "../src/lib/ndfl/model.js";
import { YEARS, SALE_YEARS } from "../src/lib/ndfl/refs.js";
const personal = {
  lastName: "Иванов", firstName: "Пётр", middleName: "Сергеевич",
  inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
  passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
  passportIssuer: "ОУФМС", phone: "+7 (912) 000-00-00", oktmo: "75701000", ifns: "7447",
};
const base = (year) => ({
  year, types: ["kvartira","ipoteka","lechenie","obuchenie","iis","strahovanie","sport"], personal,
  incomes: [
    { name: "ООО «Ромашка»", inn: "7420010847", kpp: "741501001", oktmo: "75701000", income: "1200000", withheld: "156000" },
    { name: "ООО «Лютик»", inn: "7708503727", kpp: "770801001", oktmo: "45382000", income: "300000", withheld: "39000" },
  ],
  property: { address: "г. Челябинск, ул. Ленина, 1", cadastral: "74:36:0000000:1234", cost: "2500000", dateAct: "", dateReg: "2024-03-15", priorDeduction: "", interestPaid: "250000", priorInterest: "" },
  medical: { ordinary: "60000", expensive: "10000" }, education: { self: "40000", children: [{ amount: "50000" }] },
  iis: { contribution: "100000" }, insurance: { amount: "5000" }, sport: { amount: "30000" },
  bank: { bik: "047501711", account: "40702810007710002545" }, order: null,
});
const out = process.argv[2];
for (const year of YEARS) {
  const { filename, bytes } = buildDeclarationXml(buildDeclarationModel(base(year)));
  writeFileSync(`${out}/refund-${year}.xml`, bytes);
  if (SALE_YEARS.includes(year)) {
    for (const [tag, sale] of [
      ["auto", { kind: "auto", price: "600000", saleDate: `${year}-06-10`, deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" }],
      ["realty", { kind: "realty", objectKind: "flat", cadastralNumber: "74:36:0000000:1234", cadastralValue: "9000000", price: "3000000", saleDate: `${year}-06-10`, acquireDate: "2023-01-10", realtyBasis: "purchase", deductionKind: "standard", buyerName: "Петров Пётр", buyerInn: "" }],
    ]) {
      const d = { year, types: [sale.kind === "realty" ? "prodazha_realty" : "prodazha_auto"], personal, incomes: [], sale };
      const { bytes: b } = buildDeclarationXml(buildDeclarationModel(d));
      writeFileSync(`${out}/sale-${tag}-${year}.xml`, b);
    }
  }
}
console.log("XML сгенерированы");
