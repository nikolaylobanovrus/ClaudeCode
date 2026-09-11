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
  saleClassOf,
  saleIsRealty,
  saleMinHolding,
  yearRules,
  refundDeadlineYear,
  taxOn,
} from "./refs.js";
import { fmtRub } from "../format.js";

// Разбор денежной суммы. Терпим к тому, как её могли записать: неразрывные и
// обычные пробелы между разрядами, запятая вместо точки. Поле ввода в анкете
// нормализует ввод само, но в черновик суммы попадают и другими путями —
// распознаванием документов, ссылкой-черновиком, снимком оплаченного
// комплекта. Строгий Number("1 000 000") даёт NaN, а прежний код превращал это
// в ноль молча: человек с доходом миллион получал возврат 0 и не понимал, почему.
// Склонение числительных: «2 лет» в тексте для человека читается как небрежность.
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
};

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : 0;
  const n = Number(String(v ?? "").replace(/[\s\u00a0]/g, "").replace(",", "."));
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
function parseSaleItem(item, defaultKind, warnings) {
  const s = item || {};
  // Класс определяет всё: размер вычета, пункт Приложения 6, применяется ли
  // кадастровое правило и какой срок владения освобождает от налога.
  const cls = saleClassOf(s.objectKind, s.kind || defaultKind);
  const isRealty = saleIsRealty(cls);
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
  // говорим прямо. Движимое 3 года; недвижимость 5 лет (3 в льготных случаях).
  const minHolding = saleMinHolding(cls, s.realtyBasis);
  const held = holdingYears(s.acquireDate, s.saleDate);
  const holdingExempt = held !== null && held >= minHolding;

  return {
    cls, // "home" | "realtyOther" | "movable"
    kind: isRealty ? "realty" : "auto", // грубое деление — для бланка и подписей
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
  const year = Number(draft.year) || 2025;
  const types = draft.types || [];
  const items = salesOf(draft);
  if (!items.length) return null;
  // Вид объекта берём из самой записи; ситуации на первом шаге лишь задают
  // её по умолчанию (старые черновики вида не хранили).
  const typeRealty = types.includes("prodazha_realty");
  const typeAuto = types.includes("prodazha_auto");
  if (!typeAuto && !typeRealty) return null;

  const parsed = items.map((it) =>
    parseSaleItem(it, typeRealty ? "realty" : "auto", warnings)
  );

  // Годовые остатки фиксированного вычета. Пулов ТРИ и они независимы:
  // жильё с землёй, иное недвижимое и движимое имущество (пп. 1 п. 2 ст. 220).
  const room = {
    home: SALE_DEDUCTION.realty,
    realtyOther: SALE_DEDUCTION.realtyOther,
    movable: SALE_DEDUCTION.other,
  };
  const sales = parsed.map((o) => {
    // Освобождённый объект не декларируется, значит и годовой лимит вычета
    // не расходует — иначе он «съедал» бы вычет у тех объектов, которые
    // действительно попадают в декларацию.
    if (o.holdingExempt) return { ...o, deduction: 0, base: 0, tax: 0 };
    let deduction;
    if (o.deductionKind === "expenses") {
      deduction = Math.min(o.expenses, o.taxable);
      if (o.expenses > o.taxable && o.taxable > 0) {
        warnings.push(
          "Расходы на покупку превышают доход от продажи — к вычету принят доход целиком, налог по этому объекту 0 ₽."
        );
      }
    } else {
      deduction = Math.min(room[o.cls], o.taxable);
      room[o.cls] -= deduction;
    }
    const base = Math.max(0, o.taxable - deduction);
    return { ...o, deduction, base, tax: Math.round(base * RATE) };
  });

  // Лимит израсходован не полностью по вине второй продажи — говорим прямо,
  // иначе человек решит, что вычет «не сработал».
  const CLASS_WORDS = {
    home: "объекты жилья и земли",
    realtyOther: "гаражи, машиноместа и другую нежилую недвижимость",
    movable: "машины и иное движимое имущество",
  };
  for (const cls of ["home", "realtyOther", "movable"]) {
    const std = sales.filter((o) => o.cls === cls && o.deductionKind === "standard");
    if (std.length > 1 && room[cls] === 0) {
      warnings.push(
        `Вычет ${fmtRub(SALE_DEDUCTION[cls === "home" ? "realty" : cls === "realtyOther" ? "realtyOther" : "other"])} — общий на все проданные за год ` +
          CLASS_WORDS[cls] +
          ", а не на каждый. Он уже израсходован полностью; по остальным объектам налог считается с полной цены или с ваших расходов на покупку."
      );
    }
  }

  for (const o of sales) {
    if (o.holdingExempt) {
      warnings.push(
        `Вы владели этим имуществом ${o.held} ${plural(o.held, "год", "года", "лет")} — это не меньше ` +
          `минимального срока (${o.minHolding} ${plural(o.minHolding, "год", "года", "лет")}). ` +
          `Доход от продажи налогом не облагается и декларацию 3-НДФЛ подавать НЕ нужно.`
      );
    }
  }

  // Объекты, которыми владели дольше минимального срока, в декларацию НЕ
  // попадают вовсе (п. 17.1 ст. 217, п. 2 ст. 217.1 НК): такой доход не
  // облагается и не декларируется. Раньше они оставались в расчёте, и человек
  // получал готовый документ с налогом к уплате, которого он не должен —
  // на квартире за 8 млн это 910 000 ₽ из воздуха. Предупреждение при этом
  // выводилось, но документ всё равно требовал денег.
  const declared = sales.filter((o) => !o.holdingExempt);
  const sum = (f) => declared.reduce((acc, o) => acc + f(o), 0);
  const taxable = sum((o) => o.taxable);
  const deduction = sum((o) => o.deduction);
  const base = Math.max(0, taxable - deduction);
  // Налог — от суммарной базы по шкале года, а не сложением округлённых
  // налогов по объектам: в Разделе 2 стоит одна база, и суммы обязаны сойтись.
  // С 2025 года у доходов от продажи имущества своя шкала (п. 1.1 ст. 224):
  // 13% до 2,4 млн и 15% свыше.
  const tax = taxOn(base, year, "sale");

  return {
    items: sales,
    // Объекты, которые реально идут в декларацию (без освобождённых по сроку).
    declaredItems: declared,
    price: sum((o) => o.price),
    taxable,
    deduction,
    base,
    tax,
    // Приложение 6 разбито на четыре строки: по пункту на класс имущества и
    // внутри каждого — отдельно фиксированный вычет и отдельно расходы на
    // покупку. Человек может по одной машине заявить вычет, а по другой
    // расходы, и тогда заполнены обе строки пункта.
    ded: Object.fromEntries(
      ["home", "realtyOther", "movable"].map((cls) => [
        cls,
        {
          has: sales.some((o) => o.cls === cls),
          standard: sum((o) => (o.cls === cls && o.deductionKind === "standard" ? o.deduction : 0)),
          expenses: sum((o) => (o.cls === cls && o.deductionKind === "expenses" ? o.deduction : 0)),
        },
      ])
    ),
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

  // Счёт, открытый с 2024 года, идёт не сюда, а в вычет на долгосрочные
  // сбережения (строка 250) — иначе одна и та же сумма попала бы в две строки.
  // За 2022–2023 вычета по 219.2 ещё нет, поэтому любой ИИС считается «старым»
  // (инвестиционный вычет по ст. 219.1) — иначе сумма выпала бы из расчёта.
  const iisOld = has("iis") && !(draft.iis?.newAccount && Number(draft.year) >= 2024);
  const iisEligible = iisOld
    ? Math.min(num(draft.iis?.contribution), LIMITS.iis)
    : 0;
  if (iisOld && num(draft.iis?.contribution) > LIMITS.iis) {
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
  // Лимит 3 млн по процентам ввёл ФЗ от 23.07.2013 № 212-ФЗ и только для
  // кредитов, взятых С 2014 года. По более старой ипотеке проценты
  // принимаются полностью, без потолка. Дату кредита анкета не спрашивает,
  // поэтому режем по лимиту, но говорим человеку — иначе он молча потеряет
  // вычет, на который имеет право.
  if (has("ipoteka") && num(draft.property?.interestPaid) > interestEligible) {
    warnings.push(
      `Проценты по ипотеке учтены в пределах ${fmtRub(LIMITS.interest)} — это лимит для кредитов, ` +
        "взятых с 2014 года. Если ваш кредит оформлен раньше, лимита нет и вычет положен со всей " +
        "суммы процентов: напишите нам, сделаем декларацию без ограничения."
    );
  }

  // --- Стандартный вычет на детей (пп. 4 п. 1 ст. 218) -------------------------
  // Вычет даётся помесячно, пока доход нарастающим итогом не превысил предел
  // (350 000 ₽ до 2025 года, 450 000 ₽ с 2025). Помесячного дохода анкета не
  // собирает, поэтому число месяцев оцениваем по среднему за год; человек может
  // задать его сам — в справке о доходах видно точно.
  const std = draft.standard || {};
  const stdChildren = has("deti") ? std.children || [] : [];
  // Помесячный доход (12 чисел из справки о доходах) — единственный способ
  // посчитать месяцы точно. Доход почти никогда не ровный: премия, тринадцатая
  // зарплата, выход на работу не с января. При тех же 900 000 ₽ за год «по
  // среднему» выходит 6 месяцев, а если 400 000 из них пришли в декабре — 10.
  const stdMonthly = has("deti") ? (std.monthly || []).map(num) : [];
  const stdHasMonthly = stdMonthly.some((v) => v > 0);
  const stdMonths = (() => {
    const manual = Math.round(num(std.months));
    if (manual > 0) return Math.min(12, manual);
    if (stdHasMonthly) {
      // Вычет положен ПО МЕСЯЦ, в котором доход нарастающим итогом ещё не
      // превысил предел (пп. 4 п. 1 ст. 218 НК).
      // Счёт начинаем с ПЕРВОГО месяца с доходом: до трудоустройства вычет не
      // предоставляется (пп. 4 п. 1 ст. 218 — его даёт налоговый агент за
      // месяцы работы). Раньше пустые месяцы в начале года считались
      // вычетными, и у вышедшего на работу в июле выходило 10 месяцев вместо
      // шести — завышение, которое камералка снимает.
      const first = stdMonthly.findIndex((v) => v > 0);
      if (first < 0) return 0;
      let sum = 0, months = 0;
      for (let i = first; i < 12; i++) {
        sum += stdMonthly[i] || 0;
        if (sum > rules.childLimit) break;
        months++;
      }
      return months;
    }
    if (totalIncome <= 0) return 12;
    const perMonth = totalIncome / 12;
    return Math.max(0, Math.min(12, Math.floor(rules.childLimit / perMonth)));
  })();
  // Оценка по среднему — именно оценка, и человек должен об этом знать.
  if (has("deti") && stdChildren.length && !stdHasMonthly && !(num(std.months) > 0))
    warnings.push(
      `Число месяцев для вычета на детей посчитано по среднему доходу за год (${stdMonths} мес.). ` +
        "Если доход был неровным — премия, тринадцатая зарплата, вышли на работу не с января, — " +
        "впишите доход по месяцам из справки о доходах: сумма вычета изменится."
    );
  // Сумма помесячных должна сходиться с годовым доходом, иначе одно из двух
  // введено с ошибкой, и человек об этом узнает сейчас, а не от инспектора.
  if (stdHasMonthly && totalIncome > 0) {
    const sumMonthly = stdMonthly.reduce((a, v) => a + v, 0);
    if (Math.abs(sumMonthly - totalIncome) > 1)
      warnings.push(
        `Доход по месяцам (${fmtRub(sumMonthly)}) не сходится с годовым доходом из справки ` +
          `(${fmtRub(totalIncome)}). Проверьте: месяцы влияют на размер вычета на детей.`
      );
  }
  const stdRates = rules.childDed || { first: 1400, second: 1400, third: 3000, disabled: 12000 };
  const perOrder = (o) => (o === "3" ? stdRates.third : o === "2" ? stdRates.second : stdRates.first);
  const stdDouble = Boolean(std.singleParent);
  // Обычный вычет по очерёдности и вычет на инвалида складываются
  // (п. 14 Обзора Президиума ВС РФ от 21.10.2015).
  const stdOrdinaryMonthly = stdChildren.reduce((a, c) => a + perOrder(c.order), 0);
  const stdDisabledMonthly = stdChildren.filter((c) => c.disabled).length * stdRates.disabled;
  const k = stdDouble ? 2 : 1;
  const standard = {
    months: stdMonths,
    double: stdDouble,
    // Строки 030/040 — обычный вычет, 050/060 — на ребёнка-инвалида.
    ordinary: stdOrdinaryMonthly * stdMonths * k,
    disabled: stdDisabledMonthly * stdMonths * k,
  };
  standard.eligible = standard.ordinary + standard.disabled;
  // Строка 070 — сколько уже дал работодатель, 071 — излишек, 080 — к заявлению.
  standard.byAgent = has("deti") ? num(std.providedByAgent) : 0;
  standard.excess = Math.max(0, standard.byAgent - standard.eligible);
  standard.declared = Math.max(0, standard.eligible - standard.byAgent);

  // --- Вычет на долгосрочные сбережения (ст. 219.2) ----------------------------
  // Строки 235 (ПДС), 240 (НПО), 250 (ИИС, открытый с 2024), 255 (страхование
  // жизни от 10 лет, пп. 5 — добавлен приказом ЕД-1-11/333@), 260/270 — уже
  // предоставленное, 280 — к заявлению.
  const sv = draft.savings || {};
  // Вычет введён ФЗ от 23.03.2024 № 58-ФЗ: за 2022–2023 его не существует.
  // Подпункты 1 (НПО) и 5 (страхование жизни от 10 лет) применяются к
  // договорам с 2025 года — в форме за 2024 таких строк просто нет.
  const svYear = Number(draft.year) || 0;
  const svOn = has("sberezheniya") && svYear >= 2024;
  if (has("sberezheniya") && svYear < 2024)
    warnings.push(
      "Вычет на долгосрочные сбережения действует с 2024 года — за " +
        `${draft.year} год он не заявляется, и мы его не учитывали.`
    );
  const svList = svOn ? sv.contracts || [] : [];
  const svSum = (kind) => svList.filter((c) => c.kind === kind).reduce((a, c) => a + num(c.amount), 0);
  // ИИС по 219.2 — это счёт, открытый с 2024 года; тогда взносы идут в строку
  // 250, а не в 210 (инвестиционный вычет по 219.1).
  const iis3 = svYear >= 2024 && has("iis") && draft.iis?.newAccount ? num(draft.iis?.contribution) : 0;
  const SAVINGS_LIMIT = 400_000; // совокупно по пп. 1–3 п. 1 ст. 219.2
  const svOld = svYear < 2025; // 2024: доступны только пп. 2 (ПДС) и пп. 3 (ИИС)
  const svRaw = {
    pds: svSum("pds"),
    npo: svOld ? 0 : svSum("npo"),
    iis3,
    life10: svOld ? 0 : svSum("life10"),
  };
  if (svOld && (svSum("npo") > 0 || svSum("life10") > 0))
    warnings.push(
      "Вычет по договору НПО и по страхованию жизни от 10 лет применяется к " +
        `договорам с 2025 года — в декларации за ${draft.year} год мы их не учли.`
    );
  const svGroup = svRaw.pds + svRaw.npo + svRaw.iis3;
  if (svGroup > SAVINGS_LIMIT)
    warnings.push(
      `Вычет на долгосрочные сбережения по договорам ПДС, НПО и ИИС ограничен ${fmtRub(SAVINGS_LIMIT)} в год — учли максимум.`
    );
  const scale = svGroup > SAVINGS_LIMIT ? SAVINGS_LIMIT / svGroup : 1;
  const savings = {
    pds: Math.round(svRaw.pds * scale),
    npo: Math.round(svRaw.npo * scale),
    iis3: Math.round(svRaw.iis3 * scale),
    life10: svRaw.life10,
    byAgent: svOn ? num(sv.byAgent) : 0,
    simplified: svOn ? num(sv.simplified) : 0,
  };
  savings.eligible = savings.pds + savings.npo + savings.iis3 + savings.life10;
  savings.declared = Math.max(0, savings.eligible - savings.byAgent - savings.simplified);

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
  // Стандартный вычет и вычет на долгосрочные сбережения тоже уменьшают доход,
  // и тоже «сгорают» — значит проходят через ту же воронку и ПЕРВЫМИ. Пока они
  // шли мимо неё, случалось два дефекта сразу: сумма вычетов могла оказаться
  // больше дохода (контрольное соотношение Раздела 2 требует стр. 040 ≤ 030),
  // а имущественный «расходовался» на доход, которого уже не было, и остаток
  // на будущие годы выходил заниженным — то есть деньги терялись навсегда.
  const standardApplied = take(standard.eligible);
  const savingsApplied = take(savings.eligible);
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
  // Базу уменьшает ВСЯ положенная сумма стандартного вычета, включая уже
  // предоставленную работодателем: та уже сидит в удержанном налоге из справки,
  // и если её не учесть, исчисленный налог окажется завышенным, а возврат —
  // заниженным. Ср. формулу строки 140 Приложения 7 в Порядке заполнения:
  // стандартные вычеты там считаются как (070 + 080) − 071.
  const totalDeduction = socialApplied + property + interest + standardApplied + savingsApplied;
  const taxBase = Math.max(0, totalIncome - totalDeduction);
  const assessed = taxOn(taxBase, draft.year, "main");

  // Возврат — это РАЗНИЦА между удержанным и исчисленным, а не «вычет × 13%».
  // Формула Раздела 2: строка 160 = строка 080 − строка 150, и налоговая
  // считает именно так. Прежняя формула расходилась с собственной декларацией
  // всякий раз, когда удержанный налог не равнялся ровно 13% от дохода: у
  // человека, которому работодатель уже дал вычет на детей, она обещала
  // возврат, которого не существует, — деньги «к возврату» есть на экране, но
  // нет в декларации. Заодно это само собой учитывает прогрессивную шкалу:
  // вычет снимает доход с ВЕРХНЕЙ ступени, и возвращается по её ставке.
  const refund = Math.max(0, totalWithheld - assessed);

  // Удержано больше, чем вообще можно было удержать с такого дохода — почти
  // всегда это опечатка в справке или перепутанные поля. Молчать нельзя:
  // возврат считается как «удержано минус исчислено», и завышенное удержание
  // раздувает обещанный возврат.
  if (totalWithheld > taxOn(totalIncome, draft.year, "main") + 1) {
    warnings.push(
      `Удержанный налог (${fmtRub(totalWithheld)}) больше, чем налог со всего вашего дохода ` +
        `(${fmtRub(taxOn(totalIncome, draft.year, "main"))}). Проверьте суммы в справке о доходах — ` +
        "скорее всего в одно из полей попала не та цифра."
    );
  }
  if (totalWithheld > 0 && totalDeduction > 0 && refund === 0) {
    warnings.push(
      "Возвращать нечего: удержанный за год налог уже не больше исчисленного с учётом вычетов. " +
        "Обычно это значит, что вычет вам уже предоставил работодатель."
    );
  }

  return {
    totalIncome,
    totalWithheld,
    applied: { socialGroup, childEducation, expensiveMedical, iis, property, interest,
               standard: standardApplied, savings: savingsApplied },
    standard,
    savings,
    // Социальные вычеты, уже предоставленные агентом (181) и в упрощённом
    // порядке (182): строка 190 считается как (120 + 180) − (181 + 182).
    socialProvided: {
      byAgent: num(draft.socialProvided?.byAgent),
      simplified: num(draft.socialProvided?.simplified),
    },
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
