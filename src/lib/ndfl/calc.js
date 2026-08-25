// Расчётное ядро декларации: суммы вычетов с учётом лимитов, налог к возврату,
// переносимые остатки. Чистые функции без побочных эффектов — этими же числами
// питаются экран «Проверка», PDF и XML (см. model.js).
//
// Все значения в calc.applied и calc.lines — «применённые»: обрезаны и своим
// лимитом, и остатком годового дохода. Поэтому суммы листов Приложений всегда
// сходятся с Разделом 2 (иначе ФНС отклоняет декларацию по контрольным
// соотношениям).
import {
  LIMITS,
  RATE,
  SALE_DEDUCTION,
  SALE_CADASTRAL_COEF,
  saleMinHolding,
  yearRules,
  refundDeadlineYear,
} from "./refs.js";
import { fmtRub } from "../format.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Полных лет владения между покупкой и продажей (обе даты ISO «ГГГГ-ММ-ДД»).
// Возвращает null, если какой-то даты нет. Считаем календарные годы: срок
// истекает в ту же дату спустя N лет (день покупки — начало владения).
function holdingYears(acquireIso, saleIso) {
  if (!acquireIso || !saleIso) return null;
  const a = String(acquireIso).split("-").map(Number);
  const s = String(saleIso).split("-").map(Number);
  if (a.length !== 3 || s.length !== 3 || a.some(Number.isNaN) || s.some(Number.isNaN))
    return null;
  let years = s[0] - a[0];
  if (s[1] < a[1] || (s[1] === a[1] && s[2] < a[2])) years -= 1; // ещё не «доллетал»
  return years;
}

// Ситуации продажи имущества. Здесь свой список, а не импорт из data/wizard:
// расчётное ядро не должно зависеть от слоя интерфейса.
const SALE_TYPES = ["prodazha_auto", "prodazha_realty"];

// Проданные объекты из черновика. Раньше объект был один (draft.sale), теперь
// список (draft.sales) — читаем оба вида: снимки оплаченных комплектов хранят
// старую форму, и документы по ним должны собираться как прежде.
function salesOf(draft) {
  if (Array.isArray(draft?.sales)) return draft.sales;
  return draft?.sale && typeof draft.sale === "object" ? [draft.sale] : [];
}

// Разбор одного проданного объекта: доход к налогообложению и заявленный
// вычет ДО применения годового лимита. Для авто (иного имущества) доход =
// цена договора; для недвижимости доход = max(цена, кадастр × 0,7)
// (ст. 214.10 НК) — от этого зависит и код вида дохода в Приложении 1.
function parseSaleItem(item, isRealtyType, warnings) {
  const s = item || {};
  const isRealty = isRealtyType;
  const price = num(s.price);
  const cadastral = isRealty ? num(s.cadastralValue) : 0;
  const cadastralTaxable = cadastral > 0 ? Math.round(cadastral * SALE_CADASTRAL_COEF) : 0;
  const byCadastral = isRealty && cadastralTaxable > price;
  const taxable = byCadastral ? cadastralTaxable : price;
  if (byCadastral) {
    warnings.push(
      `Доход по договору (${fmtRub(price)}) меньше кадастровой стоимости × 0,7 (${fmtRub(
        cadastralTaxable
      )}) — по ст. 214.10 НК налог считается с большей суммы.`
    );
  }

  // Срок владения (ст. 217.1 НК): владел дольше минимального — доход НЕ
  // облагается и декларацию подавать не нужно. Не берём за это деньги —
  // говорим прямо. Авто 3 года; недвижимость 5 лет (3 в льготных случаях).
  const minHolding = saleMinHolding(isRealty ? "realty" : "auto", s.realtyBasis);
  const held = holdingYears(s.acquireDate, s.saleDate);
  const holdingExempt = held !== null && held >= minHolding;

  return {
    kind: isRealty ? "realty" : "auto",
    objectKind: isRealty ? String(s.objectKind || "flat") : "",
    cadastralNumber: isRealty ? String(s.cadastralNumber || "").trim() : "",
    price,
    cadastral,
    cadastralTaxable,
    taxable,
    byCadastral,
    deductionKind: s.deductionKind === "expenses" ? "expenses" : "standard",
    expenses: num(s.expenses),
    minHolding,
    held,
    holdingExempt,
    buyer: {
      name: String(s.buyerName || "").trim(),
      inn: String(s.buyerInn || "").replace(/\D/g, ""),
    },
  };
}

// Продажа имущества → Приложение 6, налог К УПЛАТЕ (пп. 1 п. 2 ст. 220 НК).
// Возвращает null, если ситуация продажи не выбрана.
//
// Главное отличие от расчёта «по одному объекту»: фиксированный вычет —
// ГОДОВОЙ и ОБЩИЙ, а не на каждую продажу. 1 000 000 ₽ на всё проданное
// жильё и землю вместе и 250 000 ₽ на всё иное имущество вместе («не
// превышающем в целом» в тексте статьи). Форма устроена так же: в
// Приложении 6 по одной строке на каждый из двух пунктов, а не на объект.
// Объекты, по которым заявлены расходы на покупку, лимит не расходуют —
// у них свой вычет, тоже не больше собственного дохода.
function computeSale(draft, warnings) {
  const types = draft.types || [];
  const items = salesOf(draft);
  if (!items.length) return null;
  // Вид объекта берём из самой записи; ситуации на первом шаге лишь задают
  // её по умолчанию (старые черновики вида не хранили).
  const typeRealty = types.includes("prodazha_realty");
  const typeAuto = types.includes("prodazha_auto");
  if (!typeAuto && !typeRealty) return null;

  const parsed = items.map((it) =>
    parseSaleItem(
      it,
      it?.kind ? it.kind === "realty" : typeRealty,
      warnings
    )
  );

  // Годовые остатки фиксированного вычета — общие на все объекты класса.
  const room = { realty: SALE_DEDUCTION.realty, auto: SALE_DEDUCTION.other };
  const sales = parsed.map((o) => {
    let deduction;
    if (o.deductionKind === "expenses") {
      deduction = Math.min(o.expenses, o.taxable);
      if (o.expenses > o.taxable && o.taxable > 0) {
        warnings.push(
          "Расходы на покупку превышают доход от продажи — к вычету принят доход целиком, налог по этому объекту 0 ₽."
        );
      }
    } else {
      deduction = Math.min(room[o.kind], o.taxable);
      room[o.kind] -= deduction;
    }
    const base = Math.max(0, o.taxable - deduction);
    return { ...o, deduction, base, tax: Math.round(base * RATE) };
  });

  // Лимит израсходован не полностью по вине второй продажи — говорим прямо,
  // иначе человек решит, что вычет «не сработал».
  for (const kind of ["realty", "auto"]) {
    const std = sales.filter((o) => o.kind === kind && o.deductionKind === "standard");
    if (std.length > 1 && room[kind] === 0) {
      const limit = kind === "realty" ? SALE_DEDUCTION.realty : SALE_DEDUCTION.other;
      warnings.push(
        `Вычет ${fmtRub(limit)} — общий на все проданные за год ` +
          (kind === "realty" ? "объекты жилья и земли" : "машины и иное имущество") +
          ", а не на каждый. Он уже израсходован полностью; по остальным объектам налог считается с полной цены или с ваших расходов на покупку."
      );
    }
  }

  for (const o of sales) {
    if (o.holdingExempt) {
      warnings.push(
        `Вы владели этим имуществом ${o.held} ${o.held === 1 ? "год" : "лет"} — это не меньше ` +
          `минимального срока (${o.minHolding} ${o.minHolding === 3 ? "года" : "лет"}). ` +
          `Доход от продажи налогом не облагается и декларацию 3-НДФЛ подавать НЕ нужно.`
      );
    }
  }

  const sum = (f) => sales.reduce((acc, o) => acc + f(o), 0);
  const taxable = sum((o) => o.taxable);
  const deduction = sum((o) => o.deduction);
  const base = Math.max(0, taxable - deduction);
  // Налог считаем от суммарной базы, а не сложением округлённых налогов по
  // объектам: в Разделе 2 стоит одна база, и суммы обязаны сойтись.
  const tax = Math.round(base * RATE);

  return {
    items: sales,
    price: sum((o) => o.price),
    taxable,
    deduction,
    base,
    tax,
    // Приложение 6 разбито на четыре строки: по пункту на класс имущества и
    // внутри каждого — отдельно фиксированный вычет и отдельно расходы на
    // покупку. Человек может по одной машине заявить вычет, а по другой
    // расходы, и тогда заполнены обе строки пункта.
    dedRealtyStandard: sum((o) => (o.kind === "realty" && o.deductionKind === "standard" ? o.deduction : 0)),
    dedRealtyExpenses: sum((o) => (o.kind === "realty" && o.deductionKind === "expenses" ? o.deduction : 0)),
    dedOtherStandard: sum((o) => (o.kind === "auto" && o.deductionKind === "standard" ? o.deduction : 0)),
    dedOtherExpenses: sum((o) => (o.kind === "auto" && o.deductionKind === "expenses" ? o.deduction : 0)),
    hasRealty: sales.some((o) => o.kind === "realty"),
    hasOther: sales.some((o) => o.kind === "auto"),
    holdingExempt: sales.every((o) => o.holdingExempt),
  };
}

// draft — черновик мастера (см. WizardContext). Возвращает разбивку вычетов,
// итоговую сумму возврата и предупреждения для клиента.
export function computeDeclaration(draft) {
  const types = draft.types || [];
  const has = (t) => types.includes(t);
  const rules = yearRules(draft.year);
  const warnings = [];

  // Продажа имущества → Приложение 6, налог к уплате. Считаем первой.
  const sale = computeSale(draft, warnings);
  // Возвратная сторона декларации — любая ситуация, кроме продажи. При
  // комбинированной декларации (продажа + вычет) она есть, и предупреждения
  // о сроке возврата ниже уместны; при чистой продаже возвращать нечего.
  const refundSide = types.some((t) => !SALE_TYPES.includes(t));

  // Срок возврата: налог за год X возвращают при подаче до конца года X+3.
  // Исключение — пенсионер с переносом остатка имущественного вычета
  // (п. 10 ст. 220 НК): для него возврат за более старые годы законен.
  const pensionerTransfer =
    Boolean(draft.property?.pensioner) && (has("kvartira") || has("ipoteka"));
  const nowYear = new Date().getFullYear();
  if (refundSide && nowYear > refundDeadlineYear(draft.year)) {
    if (!pensionerTransfer) {
      warnings.push(
        `Срок возврата налога за ${draft.year} год истёк (вернуть можно только за три последних года). Декларацию сформируем, но налоговая, скорее всего, откажет в возврате. Исключение — пенсионеры по имущественному вычету: если это ваш случай, отметьте «Я пенсионер» на шаге «Расходы» в блоке «Жильё».`
      );
    } else if (has("lechenie") || has("obuchenie") || has("iis") || has("strahovanie") || has("sport")) {
      warnings.push(
        `Как пенсионер вы можете вернуть налог за ${draft.year} год по имущественному вычету (перенос остатка, п. 10 ст. 220 НК). Но по остальным вычетам в этой декларации (лечение, обучение, ИИС, страхование, спорт) срок возврата за ${draft.year} год уже истёк.`
      );
    }
  } else if (refundSide && nowYear === refundDeadlineYear(draft.year)) {
    warnings.push(
      `${nowYear} — последний год, когда можно вернуть налог за ${draft.year}. Подайте декларацию до конца года.`
    );
  }

  const totalIncome = (draft.incomes || []).reduce((s, i) => s + num(i.income), 0);
  const totalWithheld = (draft.incomes || []).reduce((s, i) => s + num(i.withheld), 0);

  // --- Заявляемые суммы (в пределах лимитов, но ещё без учёта дохода) --------
  // Группа с общим лимитом по году (rules.socialGroup): обычное лечение +
  // своё обучение + страхование жизни + спорт. Дорогостоящее лечение и
  // обучение детей — вне этого лимита.
  const groupSpent =
    (has("lechenie") ? num(draft.medical?.ordinary) : 0) +
    (has("obuchenie") ? num(draft.education?.self) : 0) +
    (has("strahovanie") ? num(draft.insurance?.amount) : 0) +
    (has("sport") ? num(draft.sport?.amount) : 0);
  const groupEligible = Math.min(groupSpent, rules.socialGroup);
  if (groupSpent > rules.socialGroup) {
    warnings.push(
      `Расходы на лечение, своё обучение, страхование и спорт (${fmtRub(groupSpent)}) превышают общий лимит ${fmtRub(rules.socialGroup)} — к вычету принята сумма в пределах лимита.`
    );
  }

  const childEligible = has("obuchenie")
    ? (draft.education?.children || []).reduce(
        (s, c) => s + Math.min(num(c.amount), rules.childEducation),
        0
      )
    : 0;

  const expensiveEligible = has("lechenie") ? num(draft.medical?.expensive) : 0;

  const iisEligible = has("iis")
    ? Math.min(num(draft.iis?.contribution), LIMITS.iis)
    : 0;
  if (has("iis") && num(draft.iis?.contribution) > LIMITS.iis) {
    warnings.push(
      `Взносы на ИИС учитываются в пределах ${fmtRub(LIMITS.iis)} за год.`
    );
  }

  const propertyEligible = has("kvartira")
    ? Math.min(
        num(draft.property?.cost),
        Math.max(0, LIMITS.property - num(draft.property?.priorDeduction))
      )
    : 0;
  const interestEligible = has("ipoteka")
    ? Math.min(
        num(draft.property?.interestPaid),
        Math.max(0, LIMITS.interest - num(draft.property?.priorInterest))
      )
    : 0;

  // --- Применение к доходу ----------------------------------------------------
  // Порядок важен: социальные и ИИС «сгорают» (их остаток не переносится),
  // поэтому применяются первыми; имущественный и проценты — последними,
  // их остаток переходит на следующие годы.
  let room = totalIncome;
  const take = (v) => {
    const t = Math.min(v, room);
    room -= t;
    return t;
  };
  const socialGroup = take(groupEligible);
  const childEducation = take(childEligible);
  const expensiveMedical = take(expensiveEligible);
  const iis = take(iisEligible);
  const property = take(propertyEligible);
  const interest = take(interestEligible);

  const socialEligibleTotal = groupEligible + childEligible + expensiveEligible + iisEligible;
  const socialApplied = socialGroup + childEducation + expensiveMedical + iis;
  if (socialEligibleTotal > socialApplied && totalIncome > 0) {
    warnings.push(
      "Социальные вычеты и вычет по ИИС превышают ваш доход за год — неиспользованный остаток на следующие годы не переносится."
    );
  }

  // Разбивка группового лимита по строкам Приложения 5 (тот же принцип:
  // лечение → своё обучение → страхование → спорт, пока есть место в
  // socialGroup).
  let groupRoom = socialGroup;
  const takeGroup = (v) => {
    const t = Math.min(v, groupRoom);
    groupRoom -= t;
    return t;
  };
  const lines = {
    medicalOrdinary: takeGroup(has("lechenie") ? num(draft.medical?.ordinary) : 0),
    educationSelf: takeGroup(has("obuchenie") ? num(draft.education?.self) : 0),
    insurance: takeGroup(has("strahovanie") ? num(draft.insurance?.amount) : 0),
    sport: takeGroup(has("sport") ? num(draft.sport?.amount) : 0),
  };

  const carryover = {
    property: propertyEligible - property,
    interest: interestEligible - interest,
  };

  // --- Итог -------------------------------------------------------------------
  const totalDeduction = socialApplied + property + interest;
  const taxBase = Math.max(0, totalIncome - totalDeduction);
  const assessed = Math.round(taxBase * RATE);
  const refund = Math.max(0, Math.min(Math.round(totalDeduction * RATE), totalWithheld));

  if (totalWithheld > 0 && Math.round(totalDeduction * RATE) > totalWithheld) {
    warnings.push(
      `К возврату не может быть больше удержанного за год налога (${fmtRub(totalWithheld)}).`
    );
  }
  if (totalIncome > rules.progressiveThreshold) {
    warnings.push(
      "Часть вашего дохода облагается по повышенной ставке — расчёт по 13% приблизителен, итоговую сумму уточнит налоговая."
    );
  }

  return {
    totalIncome,
    totalWithheld,
    applied: { socialGroup, childEducation, expensiveMedical, iis, property, interest },
    lines,
    socialApplied,
    totalDeduction,
    taxBase,
    assessed,
    refund,
    // Продажа имущества: sale — разбивка (или null), owed — налог к уплате.
    sale,
    owed: sale ? sale.tax : 0,
    // Комбинированная декларация: две налоговые базы живут отдельно (зарплата
    // и доход от продажи), вычеты к чужой базе не применяются. Но человеку
    // важен один итог — его и считаем: плюс значит «вернут», минус — «доплатить».
    // Сальдирует эти суммы налоговая на ЕНС, нам достаточно честно показать.
    net: refund - (sale ? sale.tax : 0),
    mixed: Boolean(sale) && refundSide,
    carryover,
    warnings,
  };
}
