// Нормализация черновика анкеты в модель декларации. Одна и та же модель
// питает PDF (pdf3ndfl.js, zayavlenie.js) и XML (xml3ndfl.js) — так данные
// в документах гарантированно совпадают.
import { computeDeclaration } from "./calc.js";
import {
  CODES,
  KBK_AGENT,
  KBK_SELF_228,
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
  // Код вида дохода (Приложение 1, строка 010) — единый для любой продажи
  // имущества (недвижимость и авто), см. SALE_CODES.
  const saleIncomeCode = calc.sale ? saleCodes.income : "";
  const sale = calc.sale
    ? {
        // Суммарные величины — для Раздела 2 и Приложения 6: и налоговая база,
        // и вычет там ОДНИ на все проданные за год объекты.
        price: calc.sale.price,
        taxable: calc.sale.taxable,
        deduction: calc.sale.deduction,
        base: calc.sale.base,
        tax: calc.sale.tax,
        // Приложение 6 разводит вычет по трём пунктам: жильё и земля, иное
        // недвижимое, иное (движимое) имущество. Внутри пункта отдельно
        // фиксированный вычет и отдельно расходы на покупку.
        ded: calc.sale.ded,
        hasRealty: calc.sale.hasRealty,
        hasOther: calc.sale.hasOther,
        // Пообъектные данные — для Приложения 1 (по источнику дохода на
        // объект) и «Расчёта к Приложению 1» (по объекту недвижимости).
        items: calc.sale.items.map((o) => ({
          cls: o.cls, // "home" | "realtyOther" | "movable" — пункт Приложения 6
          kind: o.kind, // "auto" | "realty" — нужна ли кадастровая сверка
          objectKind: o.objectKind, // вид объекта недвижимости (flat/house/…)
          price: o.price,
          cadastral: o.cadastral, // кадастровая стоимость (недвижимость)
          cadastralTaxable: o.cadastralTaxable, // кадастр × 0,7
          cadastralNumber: trim(o.cadastralNumber),
          byCadastral: o.byCadastral, // доход исчислен по кадастру
          taxable: o.taxable,
          deductionKind: o.deductionKind, // "standard" | "expenses"
          deduction: o.deduction,
          base: o.base,
          tax: o.tax,
          buyer: { name: trim(o.buyer.name), inn: digits(o.buyer.inn) },
        })),
        groupCode: saleCodes.group, // Раздел 2, строка 001
        incomeCode: saleIncomeCode, // Приложение 1, строка 010
      }
    : null;

  return {
    year: draft.year,
    // Номер корректировки: 0 — первичная, 1+ — уточнённая (НомКорр).
    correction: Number(draft.correction) || 0,
    types: draft.types || [],
    person,
    incomes,
    calc,
    // Режим декларации — то же деление, что и в маршруте мастера:
    //   refund — только вычеты, sale — только продажа, mixed — и то, и другое.
    mode: sale ? (calc.mixed ? "mixed" : "sale") : "refund",
    // КБК строки 020 Раздела 1. В комбинированной декларации их ДВА: налог с
    // продажи человек платит сам (ст. 228), а возвращает удержанный агентом.
    // Схема ФНС это допускает — СумНалПуИскл227 объявлен unbounded.
    kbk: sale && !calc.mixed ? KBK_SELF_228 : KBK_AGENT,
    kbkSale: KBK_SELF_228,
    kbkRefund: KBK_AGENT,
    ratePercent: Math.round(RATE * 100),
    refund: calc.refund,
    // Продажа: null для обычной (возвратной) декларации.
    sale,
    owed: calc.owed,
    // Итог для человека: плюс — вернут, минус — доплатить (см. calc.net).
    net: calc.net,
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
      has("lechenie") || has("obuchenie") || has("iis") || has("strahovanie") || has("sport")
        ? {
            medicalOrdinary: has("lechenie") ? num(draft.medical?.ordinary) : 0,
            medicalExpensive: has("lechenie") ? num(draft.medical?.expensive) : 0,
            educationSelf: has("obuchenie") ? num(draft.education?.self) : 0,
            educationChildren: has("obuchenie")
              ? (draft.education?.children || []).map((c) => num(c.amount)).filter(Boolean)
              : [],
            insurance: has("strahovanie") ? num(draft.insurance?.amount) : 0,
            sport: has("sport") ? num(draft.sport?.amount) : 0,
            iis: has("iis") ? num(draft.iis?.contribution) : 0,
          }
        : null,
  };
}
