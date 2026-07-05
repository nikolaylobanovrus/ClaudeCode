// Декларация 3-НДФЛ (реплика формы КНД 1151020) — PDF в браузере.
// Состав листов: Титульный, Раздел 1 + Приложение к Разделу 1 (заявление о
// возврате через сальдо ЕНС), Раздел 2, Приложение 1 (доходы), Приложение 5
// (социальные и ИИС — если выбраны), Приложение 7 (имущественный — если выбран).
// Это человекочитаемая реплика без машиночитаемых штрихкодов формы:
// дисклеймер печатается в подвале каждого листа.
import { createDoc, makeSheet, drawFooter, drawSignature, mm } from "./pdfPage.js";
import { fmtDate } from "./model.js";
import { CODES, yearRules } from "./refs.js";

const FORM_TITLE =
  "Налоговая декларация по налогу на доходы физических лиц (форма 3-НДФЛ)";

// Деньги в знакоместах: целые рубли без разделителей (как в форме).
const rub = (n) => String(Math.max(0, Math.round(Number(n) || 0)));
// Деньги с копейками для сумм доходов.
const rubKop = (n) => (Math.max(0, Number(n) || 0)).toFixed(2).replace(".", ".");

export async function buildDeclarationPdf(model) {
  const ctx = await createDoc();
  const { person, calc, year } = model;
  let pageNo = 0;
  const nextPage = () => ++pageNo;

  // ---------- Титульный лист --------------------------------------------------
  {
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      formTitle: FORM_TITLE,
      sheetTitle: `Титульный лист · КНД 1151020`,
    });
    s.fieldsRow([
      { label: "Номер корректировки", value: "0", count: 3 },
      { label: "Налоговый период (код)", value: CODES.period, count: 2 },
      { label: "Отчётный год", value: String(year), count: 4 },
      { label: "Код налогового органа", value: person.ifns, count: 4 },
      { label: "Код страны", value: CODES.country, count: 3 },
      { label: "Код категории", value: CODES.taxpayerCategory, count: 3 },
    ]);
    s.h2("Сведения о налогоплательщике");
    s.field("Фамилия", person.lastName, 30);
    s.field("Имя", person.firstName, 25);
    s.field("Отчество", person.middleName, 25);
    s.fieldsRow([
      { label: "Дата рождения", value: fmtDate(person.birthDate).replace(/\./g, ""), count: 8 },
    ]);
    s.text(`Место рождения: ${person.birthPlace || "—"}`, { size: 8.5 });

    s.h2("Сведения о документе, удостоверяющем личность");
    s.fieldsRow([
      { label: "Код вида документа", value: person.passport.code, count: 2 },
      { label: "Серия", value: person.passport.series, count: 4 },
      { label: "Номер", value: person.passport.number, count: 6 },
      {
        label: "Дата выдачи",
        value: fmtDate(person.passport.date).replace(/\./g, ""),
        count: 8,
      },
    ]);
    s.text(`Кем выдан: ${person.passport.issuer || "—"}`, { size: 8.5 });
    s.advance(2);
    s.fieldsRow([
      { label: "Статус налогоплательщика", value: CODES.status, count: 1 },
    ]);
    if (person.phone) s.text(`Номер контактного телефона: ${person.phone}`, { size: 8.5 });
    s.divider();
    drawSignature(s, ctx, person.fio);
    drawFooter(s, ctx);
  }

  // ---------- Раздел 1 + Заявление о возврате ---------------------------------
  {
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      sheetTitle:
        "Раздел 1. Сведения о суммах налога, подлежащих уплате (доплате) / возврату",
    });
    s.line("010", "Код (1 — уплата, 2 — возврат, 3 — отсутствие)", "2", 1);
    s.line("020", "Код бюджетной классификации (КБК)", model.kbk, 20);
    s.line("030", "Код по ОКТМО", person.oktmo, 11);
    s.line("040", "Сумма налога, подлежащая уплате, руб.", "0");
    s.line("050", "Сумма налога, подлежащая возврату из бюджета, руб.", rub(model.refund));

    s.h2(
      "Приложение к Разделу 1. Заявление о распоряжении путём возврата суммы денежных средств, формирующих положительное сальдо ЕНС"
    );
    s.line("075", "Номер заявления", "1", 3);
    s.line("080", "Сумма к возврату, руб.", rub(model.refund));
    s.h2("Сведения о счёте");
    s.line("090", "БИК банка", model.bank.bik, 9);
    s.line("100", "Вид счёта (код 02 — текущий)", model.bank.kind, 2);
    s.line("110", "Номер счёта", model.bank.account, 20);
    s.divider();
    s.note(
      "Возврат придёт после камеральной проверки декларации (до 3 месяцев) на указанный счёт."
    );
    drawFooter(s, ctx);
  }

  // ---------- Раздел 2 ---------------------------------------------------------
  {
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      sheetTitle:
        "Раздел 2. Расчёт налоговой базы и суммы налога по видам доходов",
    });
    s.line("001", "Код вида дохода", CODES.incomeKind, 2);
    s.h2("Расчёт налоговой базы");
    s.line("010", "Общая сумма доходов, руб. коп.", rubKop(calc.totalIncome), 15);
    s.line("020", "Сумма доходов, не подлежащих налогообложению, руб.", "0");
    s.line("030", "Сумма доходов, подлежащих налогообложению, руб. коп.", rubKop(calc.totalIncome), 15);
    s.line("040", "Сумма налоговых вычетов, руб. коп.", rubKop(calc.totalDeduction), 15);
    s.line("060", "Налоговая база, руб. коп.", rubKop(calc.taxBase), 15);
    s.h2("Расчёт суммы налога");
    s.line("070", "Сумма налога, исчисленная к уплате, руб.", rub(calc.assessed));
    s.line("080", "Сумма налога, удержанная у источника выплаты, руб.", rub(calc.totalWithheld));
    s.line("160", "Сумма налога, подлежащая возврату из бюджета, руб.", rub(model.refund));
    drawFooter(s, ctx);
  }

  // ---------- Приложение 1: доходы от источников в РФ --------------------------
  {
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      sheetTitle:
        "Приложение 1. Доходы от источников в Российской Федерации",
    });
    model.incomes.forEach((inc, i) => {
      s.h2(`Источник выплаты ${i + 1}`);
      s.line("010", "Код вида дохода", CODES.incomeKind, 2);
      s.line("020", "Налоговая ставка, %", String(model.ratePercent), 3);
      s.line("030", "ИНН источника выплаты", inc.inn, 12);
      s.line("040", "КПП", inc.kpp || "", 9);
      s.line("050", "Код по ОКТМО", inc.oktmo, 11);
      s.text(`060 Наименование: ${inc.name}`, { size: 8.5 });
      s.line("070", "Сумма дохода, руб. коп.", rubKop(inc.income), 15);
      s.line("080", "Сумма налога удержанная, руб.", rub(inc.withheld));
      s.divider();
    });
    drawFooter(s, ctx);
  }

  // ---------- Приложение 5: социальные вычеты и ИИС -----------------------------
  if (model.social) {
    const so = model.social;
    const ap = calc.applied;
    const rulesY = yearRules(year);
    const limitStr = (n) => n.toLocaleString("ru-RU");
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      sheetTitle:
        "Приложение 5. Расчёт стандартных, социальных и инвестиционных налоговых вычетов",
    });
    // Все значения — «применённые» (см. calc.js): суммы строк Приложения 5
    // сходятся со строкой 040 Раздела 2 даже при вычетах больше дохода.
    s.h2("Социальные вычеты, к которым не применяется ограничение");
    s.line("100", `Обучение детей (не более ${limitStr(rulesY.childEducation)} руб. на ребёнка), руб.`, rub(ap.childEducation));
    s.line("110", "Дорогостоящее лечение, руб.", rub(ap.expensiveMedical));
    s.line("120", "Итого по пункту, руб.", rub(ap.childEducation + ap.expensiveMedical));
    s.h2(`Социальные вычеты, к которым применяется ограничение ${limitStr(rulesY.socialGroup)} руб.`);
    s.line("130", "Своё обучение, руб.", rub(calc.lines.educationSelf));
    s.line("140", "Лечение и лекарства (кроме дорогостоящего), руб.", rub(calc.lines.medicalOrdinary));
    s.line("150", "Страхование жизни (договоры от 5 лет), руб.", rub(calc.lines.insurance));
    s.line("180", `Итого (в пределах ${limitStr(rulesY.socialGroup)} руб.), руб.`, rub(ap.socialGroup));
    s.line(
      "190",
      "Общая сумма социальных вычетов, руб.",
      rub(ap.socialGroup + ap.childEducation + ap.expensiveMedical)
    );
    if (so.iis > 0) {
      s.h2("Инвестиционный налоговый вычет (ИИС, тип А)");
      s.line("210", "Сумма вычета по взносам на ИИС, руб.", rub(ap.iis));
    }
    drawFooter(s, ctx);
  }

  // ---------- Приложение 7: имущественный вычет --------------------------------
  if (model.property) {
    const pr = model.property;
    const ap = calc.applied;
    const s = makeSheet(ctx, {
      inn: person.inn,
      pageNo: nextPage(),
      sheetTitle:
        "Приложение 7. Расчёт имущественных налоговых вычетов по расходам на приобретение жилья",
    });
    s.line("010", "Код наименования объекта (2 — квартира)", "2", 2);
    s.line("020", "Код признака налогоплательщика (01 — собственник)", "01", 2);
    if (pr.cadastral) {
      s.line("031", "Код номера объекта (1 — кадастровый)", "1", 1);
      s.text(`032 Кадастровый номер: ${pr.cadastral}`, { size: 8.5 });
    }
    s.text(`Адрес объекта: ${pr.address}`, { size: 8.5 });
    s.advance(2);
    if (pr.dateAct)
      s.line("040", "Дата акта о передаче (дд.мм.гггг)", fmtDate(pr.dateAct).replace(/\./g, ""), 8);
    if (pr.dateReg)
      s.line("050", "Дата регистрации права (дд.мм.гггг)", fmtDate(pr.dateReg).replace(/\./g, ""), 8);
    s.h2("Расчёт вычета");
    s.line("080", "Стоимость объекта (в пределах лимита), руб.", rub(Math.min(pr.cost, 2_000_000)));
    s.line("090", "Проценты по займам (кредитам), руб.", rub(pr.interestPaid));
    s.line("100", "Вычет по расходам, учтённый в предыдущие периоды, руб.", rub(pr.priorDeduction));
    s.line("110", "Вычет по процентам, учтённый ранее, руб.", rub(pr.priorInterest));
    s.line("150", "Вычет по расходам, заявляемый за отчётный год, руб.", rub(ap.property));
    s.line("160", "Вычет по процентам, заявляемый за отчётный год, руб.", rub(ap.interest));
    s.line("170", "Остаток вычета по расходам на следующий год, руб.", rub(calc.carryover.property));
    s.line("180", "Остаток вычета по процентам на следующий год, руб.", rub(calc.carryover.interest));
    drawFooter(s, ctx);
  }

  // Число страниц на титульный лист не выносим отдельным полем —
  // номера проставлены в шапке каждого листа.
  return ctx.doc.save();
}
