// Нормализация черновика анкеты в модель декларации. Одна и та же модель
// питает PDF (pdf3ndfl.js, zayavlenie.js) и XML (xml3ndfl.js) — так данные
// в документах гарантированно совпадают.
import { computeDeclaration } from "./calc.js";
import {
  CODES,
  KBK,
  RATE,
  SALE_CODES,
  propertyObjectCode,
  propertySignCode,
  propertyIsHouse,
} from "./refs.js";
import { digits } from "../format.js";

const trim = (s) => String(s || "").trim();
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// Дата "2024-05-20" → "20.05.2024" (формат печатной формы).
export const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(iso);
};

export function buildDeclarationModel(draft) {
  const calc = computeDeclaration(draft);
  const p = draft.personal || {};
  const b = draft.bank || {};
  const pr = draft.property || {};

  const person = {
    lastName: trim(p.lastName),
    firstName: trim(p.firstName),
    middleName: trim(p.middleName),
    fio: [p.lastName, p.firstName, p.middleName].map(trim).filter(Boolean).join(" "),
    inn: digits(p.inn),
    birthDate: p.birthDate || "",
    birthPlace: trim(p.birthPlace),
    passport: {
      code: CODES.passport,
      series: digits(p.passportSeries),
      number: digits(p.passportNumber),
      date: p.passportDate || "",
      issuer: trim(p.passportIssuer),
    },
    phone: trim(p.phone),
    oktmo: digits(p.oktmo),
    ifns: digits(p.ifns),
  };

  const incomes = (draft.incomes || [])
    .filter((i) => num(i.income) > 0)
    .map((i) => ({
      name: trim(i.name),
      inn: digits(i.inn),
      kpp: digits(i.kpp),
      oktmo: digits(i.oktmo),
      income: num(i.income),
      withheld: num(i.withheld),
    }));

  const has = (t) => (draft.types || []).includes(t);

  // Приложение 6 (продажа имущества): готовый блок с кодами формы за год.
  // Раздел 2 «код группы доходов» (001) и Приложение 1 «код вида дохода» (010)
  // берём из SALE_CODES; для источника-физлица (покупателя) в Приложении 1
  // пишем ФИО и, если известен, ИНН.
  const saleCodes = SALE_CODES[draft.year] || SALE_CODES[2025];
  const sale = calc.sale
    ? {
        kind: calc.sale.kind,
        price: calc.sale.price,
        taxable: calc.sale.taxable,
        deductionKind: calc.sale.deductionKind, // "standard" | "expenses"
        deduction: calc.sale.deduction,
        base: calc.sale.base,
        tax: calc.sale.tax,
        buyer: {
          name: trim(calc.sale.buyer.name),
          inn: digits(calc.sale.buyer.inn),
        },
        groupCode: saleCodes.group, // Раздел 2, строка 001
        incomeCode: saleCodes.incomeAuto, // Приложение 1, строка 010 (авто/иное)
      }
    : null;

  return {
    year: draft.year,
    types: draft.types || [],
    person,
    incomes,
    calc,
    kbk: KBK,
    ratePercent: Math.round(RATE * 100),
    refund: calc.refund,
    // Продажа: null для обычной (возвратной) декларации.
    sale,
    owed: calc.owed,
    bank: { bik: digits(b.bik), account: digits(b.account), kind: CODES.accountKind },
    // Приложение 7 (имущественный) — только если выбран соответствующий вычет
    property:
      has("kvartira") || has("ipoteka")
        ? {
            address: trim(pr.address),
            cadastral: trim(pr.cadastral),
            cost: num(pr.cost),
            dateAct: pr.dateAct || "",
            dateReg: pr.dateReg || "",
            priorDeduction: num(pr.priorDeduction),
            priorInterest: num(pr.priorInterest),
            interestPaid: num(pr.interestPaid),
            // Коды Приложения 7 (строки 010/020/030). Значения из анкеты
            // семантические; номер кода зависит от года формы. Черновики,
            // созданные до появления этих полей, получают прежние значения
            // по умолчанию: квартира, собственник — сам налогоплательщик.
            codes: {
              object: propertyObjectCode(pr.objectKind || "flat", draft.year),
              sign: propertySignCode(pr.owner || "self", Boolean(pr.pensioner)),
              build: propertyIsHouse(pr.objectKind)
                ? pr.buildMethod === "new"
                  ? "1"
                  : "2"
                : "",
            },
          }
        : null,
    // Приложение 5 (социальные и ИИС)
    social:
      has("lechenie") || has("obuchenie") || has("iis") || has("strahovanie")
        ? {
            medicalOrdinary: has("lechenie") ? num(draft.medical?.ordinary) : 0,
            medicalExpensive: has("lechenie") ? num(draft.medical?.expensive) : 0,
            educationSelf: has("obuchenie") ? num(draft.education?.self) : 0,
            educationChildren: has("obuchenie")
              ? (draft.education?.children || []).map((c) => num(c.amount)).filter(Boolean)
              : [],
            insurance: has("strahovanie") ? num(draft.insurance?.amount) : 0,
            iis: has("iis") ? num(draft.iis?.contribution) : 0,
          }
        : null,
  };
}
