// Расчёт налога с продажи имущества — та же арифметика, что в calc.js
// (computeSale), но без черновика анкеты: чистые числа на входе, чистые числа
// на выходе. Нужен калькулятору на лендинге, где никакой анкеты ещё нет.
//
// Единственный источник правил — refs.js. Если ФНС поменяет лимиты вычета или
// коэффициент кадастра, править надо там, и оба места подхватят новое.
import {
  RATE,
  SALE_DEDUCTION,
  SALE_CADASTRAL_COEF,
  saleMinHolding,
} from "./refs.js";

// Полных лет владения между двумя датами (ISO). null — если дат не хватает.
// Копия логики holdingYears из calc.js: «доллетал» считается по дню и месяцу,
// иначе продажа 01.01 давала бы лишний год.
export function holdingYears(acquireIso, saleIso) {
  if (!acquireIso || !saleIso) return null;
  const a = acquireIso.split("-").map(Number);
  const s = saleIso.split("-").map(Number);
  if (a.length !== 3 || s.length !== 3 || !a[0] || !s[0]) return null;
  let years = s[0] - a[0];
  if (s[1] < a[1] || (s[1] === a[1] && s[2] < a[2])) years -= 1;
  return years;
}

/**
 * @param {object} p
 * @param {"realty"|"auto"} p.kind          вид имущества
 * @param {number} p.price                  цена продажи по договору, ₽
 * @param {number} p.expenses              расходы на покупку, ₽ (0 — не заявляются)
 * @param {number} p.cadastral             кадастровая стоимость, ₽ (недвижимость)
 * @param {string} p.acquireDate           дата приобретения (YYYY-MM-DD)
 * @param {string} p.saleDate              дата продажи (YYYY-MM-DD)
 * @param {string} p.realtyBasis           основание приобретения (льготный срок)
 */
export function computeSaleTax({
  kind = "auto",
  price = 0,
  expenses = 0,
  cadastral = 0,
  acquireDate = "",
  saleDate = "",
  realtyBasis = "purchase",
}) {
  const isRealty = kind === "realty";

  // Доход к налогообложению: недвижимость — большее из цены договора и
  // 0,7 кадастровой стоимости (ст. 214.10 НК); авто — цена договора.
  const cadastralTaxable =
    isRealty && cadastral > 0 ? Math.round(cadastral * SALE_CADASTRAL_COEF) : 0;
  const byCadastral = cadastralTaxable > price;
  const taxable = byCadastral ? cadastralTaxable : price;

  // Считаем ОБА варианта вычета и выбираем выгодный: людям важно увидеть, что
  // договор покупки экономит деньги (или что не экономит — тогда не искать его).
  const limit = isRealty ? SALE_DEDUCTION.realty : SALE_DEDUCTION.other;
  const byLimit = Math.max(0, taxable - Math.min(limit, taxable));
  const byExpenses =
    expenses > 0 ? Math.max(0, taxable - Math.min(expenses, taxable)) : null;
  const useExpenses = byExpenses !== null && byExpenses < byLimit;

  const deductionKind = useExpenses ? "expenses" : "standard";
  const deduction = Math.min(useExpenses ? expenses : limit, taxable);
  const base = Math.max(0, taxable - deduction);

  // Срок владения (ст. 217.1 НК): продержал дольше минимального — доход не
  // облагается и декларацию подавать НЕ нужно. Говорим об этом прямо, даже
  // если это значит «вы нам не клиент».
  const minHolding = saleMinHolding(kind, realtyBasis);
  const held = holdingYears(acquireDate, saleDate);
  const exempt = held !== null && held >= minHolding;

  return {
    kind,
    taxable,
    cadastralTaxable,
    byCadastral,
    limit,
    deductionKind,
    deduction,
    base,
    tax: exempt ? 0 : Math.round(base * RATE),
    taxByLimit: Math.round(byLimit * RATE),
    taxByExpenses: byExpenses === null ? null : Math.round(byExpenses * RATE),
    minHolding,
    held,
    exempt,
    rate: RATE,
  };
}
