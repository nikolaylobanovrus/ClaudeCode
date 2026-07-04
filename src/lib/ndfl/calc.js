// Расчётное ядро декларации: суммы вычетов с учётом лимитов, налог к возврату,
// переносимые остатки. Чистые функции без побочных эффектов — этими же числами
// питаются экран «Проверка», PDF и XML (см. model.js).
//
// Все значения в calc.applied и calc.lines — «применённые»: обрезаны и своим
// лимитом, и остатком годового дохода. Поэтому суммы листов Приложений всегда
// сходятся с Разделом 2 (иначе ФНС отклоняет декларацию по контрольным
// соотношениям).
import { LIMITS, RATE, PROGRESSIVE_THRESHOLD } from "./refs.js";
import { fmtRub } from "../format.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// draft — черновик мастера (см. WizardContext). Возвращает разбивку вычетов,
// итоговую сумму возврата и предупреждения для клиента.
export function computeDeclaration(draft) {
  const types = draft.types || [];
  const has = (t) => types.includes(t);
  const warnings = [];

  const totalIncome = (draft.incomes || []).reduce((s, i) => s + num(i.income), 0);
  const totalWithheld = (draft.incomes || []).reduce((s, i) => s + num(i.withheld), 0);

  // --- Заявляемые суммы (в пределах лимитов, но ещё без учёта дохода) --------
  // Группа с общим лимитом 150 000 ₽: обычное лечение + своё обучение +
  // страхование жизни. Дорогостоящее лечение и обучение детей — вне лимита.
  const groupSpent =
    (has("lechenie") ? num(draft.medical?.ordinary) : 0) +
    (has("obuchenie") ? num(draft.education?.self) : 0) +
    (has("strahovanie") ? num(draft.insurance?.amount) : 0);
  const groupEligible = Math.min(groupSpent, LIMITS.socialGroup);
  if (groupSpent > LIMITS.socialGroup) {
    warnings.push(
      `Расходы на лечение, своё обучение и страхование (${fmtRub(groupSpent)}) превышают общий лимит ${fmtRub(LIMITS.socialGroup)} — к вычету принята сумма в пределах лимита.`
    );
  }

  const childEligible = has("obuchenie")
    ? (draft.education?.children || []).reduce(
        (s, c) => s + Math.min(num(c.amount), LIMITS.childEducation),
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
  // лечение → своё обучение → страхование, пока есть место в socialGroup).
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
    lines,
    socialApplied,
    totalDeduction,
    taxBase,
    assessed,
    refund,
    carryover,
    warnings,
  };
}
