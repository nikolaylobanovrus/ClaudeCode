// Расчётное ядро декларации: суммы вычетов с учётом лимитов, налог к возврату,
// переносимые остатки. Чистые функции без побочных эффектов — этими же числами
// питаются экран «Проверка», PDF и XML (см. model.js).
import { LIMITS, RATE, PROGRESSIVE_THRESHOLD } from "./refs.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const fmtMoney = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";

// draft — черновик мастера (см. WizardContext). Возвращает разбивку вычетов,
// итоговую сумму возврата и предупреждения для клиента.
export function computeDeclaration(draft) {
  const types = draft.types || [];
  const has = (t) => types.includes(t);
  const warnings = [];

  const totalIncome = (draft.incomes || []).reduce((s, i) => s + num(i.income), 0);
  const totalWithheld = (draft.incomes || []).reduce((s, i) => s + num(i.withheld), 0);

  // --- Социальные вычеты -----------------------------------------------------
  // Группа с общим лимитом 150 000 ₽: обычное лечение + своё обучение +
  // страхование жизни. Дорогостоящее лечение и обучение детей — вне лимита.
  const groupSpent =
    (has("lechenie") ? num(draft.medical?.ordinary) : 0) +
    (has("obuchenie") ? num(draft.education?.self) : 0) +
    (has("strahovanie") ? num(draft.insurance?.amount) : 0);
  const socialGroup = Math.min(groupSpent, LIMITS.socialGroup);
  if (groupSpent > LIMITS.socialGroup) {
    warnings.push(
      `Расходы на лечение, своё обучение и страхование (${fmtMoney(groupSpent)}) превышают общий лимит ${fmtMoney(LIMITS.socialGroup)} — к вычету принята сумма в пределах лимита.`
    );
  }

  const childEducation = has("obuchenie")
    ? (draft.education?.children || []).reduce(
        (s, c) => s + Math.min(num(c.amount), LIMITS.childEducation),
        0
      )
    : 0;

  const expensiveMedical = has("lechenie") ? num(draft.medical?.expensive) : 0;

  const iis = has("iis") ? Math.min(num(draft.iis?.contribution), LIMITS.iis) : 0;
  if (has("iis") && num(draft.iis?.contribution) > LIMITS.iis) {
    warnings.push(
      `Взносы на ИИС учитываются в пределах ${fmtMoney(LIMITS.iis)} за год.`
    );
  }

  // Социальные и ИИС применяются в первую очередь: их остаток не переносится
  // на следующие годы («сгорает»), а имущественный — переносится.
  const socialTotal = socialGroup + childEducation + expensiveMedical + iis;
  const socialApplied = Math.min(socialTotal, totalIncome);
  if (socialTotal > totalIncome && totalIncome > 0) {
    warnings.push(
      "Социальные вычеты и вычет по ИИС превышают ваш доход за год — неиспользованный остаток на следующие годы не переносится."
    );
  }

  // --- Имущественный вычет и проценты по ипотеке ------------------------------
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

  let rest = Math.max(0, totalIncome - socialApplied);
  const property = Math.min(propertyEligible, rest);
  rest -= property;
  const interest = Math.min(interestEligible, rest);

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
      `К возврату не может быть больше удержанного за год налога (${fmtMoney(totalWithheld)}).`
    );
  }
  const threshold = PROGRESSIVE_THRESHOLD[draft.year] || Infinity;
  if (totalIncome > threshold) {
    warnings.push(
      "Часть вашего дохода облагается по повышенной ставке — расчёт по 13% приблизителен, итоговую сумму уточнит налоговая."
    );
  }

  return {
    totalIncome,
    totalWithheld,
    applied: { socialGroup, childEducation, expensiveMedical, iis, property, interest },
    socialApplied,
    totalDeduction,
    taxBase,
    assessed,
    refund,
    carryover,
    warnings,
  };
}
