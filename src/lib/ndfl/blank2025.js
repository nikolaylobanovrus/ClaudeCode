// Декларация за 2025 год на подлинном бланке ФНС (приказ от 20.10.2025
// № ЕД-7-11/913@, КНД 1151020). Движок и правила печати — blankPdf.js;
// происхождение бланка и метод извлечения координат — docs/fns-blank-2025.md.
import blankUrl from "../../assets/ndfl/blank-2025.pdf?url";
import { assembleOnBlank, fillRows, chunk } from "./blankPdf.js";
import { CODES } from "./refs.js";
import { digits } from "../format.js";

// Индексы страниц внутри blank-2025.pdf (порядок задан при нарезке бланка).
// app6 — лист Приложения 6 (доходы от продажи), добавлен восьмой страницей.
const PG = { title: 0, r1: 1, r1app: 2, r2: 3, app1: 4, app5a: 5, app5b: 6, app7: 7, app6: 8, raschet: 9 };

export async function buildOfficialPdf2025(model) {
  const { person, calc } = model;
  const ap = calc.applied;
  const sale = model.sale;

  // Продажа: без заявления о возврате (Приложение к Разделу 1), Приложение 1 —
  // покупатель как источник дохода, добавляется Приложение 6. Возврат: как было.
  const sheets = sale
    ? [
        { tpl: PG.title, fill: fillTitle },
        { tpl: PG.r1, fill: fillR1 },
        { tpl: PG.r2, fill: fillR2 },
        { tpl: PG.app1, fill: fillApp1Sale },
        { tpl: PG.app6, fill: fillApp6 },
        // Недвижимость: лист «Расчёт к Приложению 1» — сверка дохода с
        // кадастровой стоимостью (ст. 214.10 НК).
        ...(sale.kind === "realty" ? [{ tpl: PG.raschet, fill: fillRaschet }] : []),
      ]
    : [
        { tpl: PG.title, fill: fillTitle },
        { tpl: PG.r1, fill: fillR1 },
        { tpl: PG.r1app, fill: fillR1App },
        { tpl: PG.r2, fill: fillR2 },
      ];
  if (!sale) {
    for (const part of chunk(model.incomes, 3))
      sheets.push({ tpl: PG.app1, fill: (pen) => fillApp1(pen, part) });
    if (model.social) {
      sheets.push({ tpl: PG.app5a, fill: fillApp5a });
      sheets.push({ tpl: PG.app5b, fill: fillApp5b });
    }
    if (model.property) sheets.push({ tpl: PG.app7, fill: fillApp7 });
  }
  const total = sheets.length;

  return assembleOnBlank({ blankUrl, person, sheets });

  // --- Титульный лист --------------------------------------------------------
  function fillTitle(pen) {
    pen.left("0", 91.0, 717, 3); // номер корректировки
    pen.left(CODES.period, 215.7, 717, 2); // налоговый период — 34 (год)
    pen.left(String(model.year), 337.6, 717, 4);
    pen.left(person.ifns, 524.7, 717, 4); // код налогового органа
    pen.left(CODES.country, 85.3, 662, 3); // 643 — Россия
    pen.left(CODES.taxpayerCategory, 340.4, 662, 3); // 760 — иное физлицо
    pen.left(person.lastName, 85.3, 633, 35);
    pen.left(person.firstName, 85.3, 607, 35);
    pen.left(person.middleName, 85.3, 581, 35);
    // Блок «если в документе не указан ИНН» (ЕРН, дата рождения, документ)
    // по порядку заполнения остаётся пустым: ИНН указан всегда.
    pen.left(CODES.status, 184.5, 389, 1); // 1 — налоговый резидент
    pen.left(digits(person.phone), 156.2, 360, 20);
    pen.left(String(total).padStart(3, "0"), 133.5, 266, 3); // «на … страницах»
    pen.left("1", 34.3, 216, 1); // достоверность подтверждает налогоплательщик
  }

  // --- Раздел 1: налог к уплате (продажа) или к возврату ----------------------
  function fillR1(pen) {
    pen.left(model.kbk, 295.1, 672, 20); // 020 КБК
    pen.left(person.oktmo, 295.1, 645, 11); // 030 ОКТМО
    pen.int(sale ? model.owed : 0, 295.1, 619, 13); // 040 к уплате
    pen.int(sale ? 0 : model.refund, 295.1, 592, 13); // 050 к возврату
  }

  // --- Приложение к Разделу 1: заявление о возврате (ст. 79 НК) ---------------
  function fillR1App(pen) {
    pen.money(model.refund, 210.1, 690, 13); // 010 в размере
    pen.left(model.bank.bik, 210.1, 649, 9); // 020 БИК
    pen.left(model.bank.account, 210.1, 623, 20); // 030 номер счёта
  }

  // --- Раздел 2: налоговая база и сумма налога ---------------------------------
  // Продажа: группа доходов «02», база = доход − вычет Приложения 6, налог
  // печатается в строку 150 «к уплате». Возврат: как раньше (строка 160).
  function fillR2(pen) {
    const X = 351.8;
    const income = sale ? sale.taxable : calc.totalIncome;
    pen.left(sale ? sale.groupCode : "01", X, 710, 2); // 001 код группы доходов
    pen.money(income, X, 683, 13); // 010 доходы
    pen.money(0, X, 659, 13); // 020 не облагаемые
    pen.money(income, X, 630, 13); // 030 облагаемые
    pen.money(sale ? sale.deduction : calc.totalDeduction, X, 602, 13); // 040 вычеты
    pen.money(0, X, 573, 13); // 050 расходы
    pen.money(sale ? sale.base : calc.taxBase, X, 548, 13); // 060 налоговая база
    pen.int(sale ? sale.tax : calc.assessed, X, 495, 13); // 070 исчислено
    pen.int(sale ? 0 : calc.totalWithheld, X, 470, 13); // 080 удержано
    pen.int(0, X, 445, 13); // 090 матвыгода
    pen.int(0, X, 416, 13); // 100 торговый сбор
    pen.int(0, X, 388, 13); // 120 авансовые
    pen.int(0, X, 348, 13); // 130 за рубежом
    pen.int(0, X, 319, 13); // 140 патент
    pen.int(sale ? model.owed : 0, X, 290, 13); // 150 к уплате
    pen.int(sale ? 0 : model.refund, X, 265, 13); // 160 к возврату
    pen.int(0, X, 241, 13); // 170 упрощённый вычет
  }

  // --- Приложение 1: до трёх источников дохода на листе ------------------------
  function fillApp1(pen, incomes) {
    const codeY = [714, 498, 283];
    const idY = [678, 462, 247];
    const nameY = [
      [642, 618, 595, 572],
      [426, 403, 380, 356],
      [211, 187, 164, 141],
    ];
    const sumY = [533, 318, 102];
    incomes.forEach((inc, i) => {
      pen.left("010", 119.3, codeY[i], 3); // код вида дохода (2025 — «010»)
      pen.right(String(model.ratePercent), 527.5, codeY[i], 2); // ставка
      pen.left(inc.inn, 14.5, idY[i], 12);
      pen.left(inc.kpp, 227.1, idY[i], 9);
      pen.left(inc.oktmo, 400.0, idY[i], 11);
      fillRows(pen, inc.name, 14.5, nameY[i], 40);
      pen.money(inc.income, 14.5, sumY[i], 13); // 070 доход
      pen.int(inc.withheld, 297.9, sumY[i], 13); // 080 удержано
    });
  }

  // --- Приложение 1 (продажа): источник дохода — покупатель --------------------
  // Код вида дохода «018» (продажа иного имущества), ставка 13 %, ОКТМО — по
  // месту жительства продавца; ИНН пишем только для физлица (12 цифр).
  function fillApp1Sale(pen) {
    const b = sale.buyer;
    pen.left(sale.incomeCode, 119.3, 714, 3); // 010 код вида дохода
    pen.right(String(model.ratePercent), 527.5, 714, 2); // ставка
    if (b.inn.length === 12) pen.left(b.inn, 14.5, 678, 12); // ИНН физлица
    pen.left(person.oktmo, 400.0, 678, 11); // ОКТМО по месту жительства
    fillRows(pen, b.name || "Физическое лицо", 14.5, [642, 618, 595, 572], 40);
    pen.money(sale.price, 14.5, 533, 13); // 070 сумма дохода
    pen.int(0, 297.9, 533, 13); // 080 налог удержан — 0
  }

  // --- Приложение 6: имущественный вычет по доходам от продажи -----------------
  // Строка 160 — итоговая сумма вычетов (общая для всех пунктов). Пункт по типу
  // имущества: жильё и земля (пункт 1) — строка 010 (вычет до 1 млн ₽) ЛИБО 020
  // (расходы); авто и иное движимое (пункт 3) — строка 070 (вычет 250 тыс ₽)
  // ЛИБО 080 (расходы).
  function fillApp6(pen) {
    const X = 422.7;
    const expenses = sale.deductionKind === "expenses";
    if (sale.kind === "realty") {
      if (expenses) pen.money(sale.deduction, X, 652.9, 8); // 020 расходы
      else pen.money(sale.deduction, X, 678.4, 8); // 010 вычет 1 млн
    } else {
      if (expenses) pen.money(sale.deduction, X, 468.7, 8); // 080 расходы
      else pen.money(sale.deduction, X, 494.2, 8); // 070 вычет 250 тыс
    }
    pen.money(sale.deduction, X, 64.9, 8); // 160 общая сумма вычетов
  }

  // --- Расчёт к Приложению 1: сверка дохода с кадастровой стоимостью -----------
  // Пункт 1 (недвижимость): 010 — признак «1» (отчуждение); 020 — кадастровый
  // номер; 030 — кадастровая стоимость (ст. 214.10); 040 — доход по цене
  // договора; 050 — кадастр × коэффициент 0,7; 060 — доход к налогообложению
  // (большее из 040 и 050). Кадастровую стоимость требуем на шаге «Продажа».
  function fillRaschet(pen) {
    pen.left("1", 17.3, 685, 1); // 010 признак — отчуждение
    pen.left(sale.cadastralNumber, 14.2, 645, 40); // 020 кадастровый номер
    pen.money(sale.cadastral, 14.2, 558.8, 13); // 030 кадастровая стоимость
    pen.money(sale.price, 334.8, 558.8, 13); // 040 доход по цене договора
    pen.money(sale.cadastralTaxable, 14.2, 501.1, 13); // 050 кадастр × 0,7
    pen.money(sale.taxable, 334.8, 501.1, 13); // 060 доход к налогообложению
  }

  // --- Приложение 5, лист 1: соц. вычеты без ограничения + своё обучение -------
  function fillApp5a(pen) {
    const X = 365.9;
    if (ap.childEducation > 0) pen.money(ap.childEducation, X, 286, 12); // 100
    if (ap.expensiveMedical > 0) pen.money(ap.expensiveMedical, X, 199, 12); // 110
    pen.money(ap.childEducation + ap.expensiveMedical, X, 173, 12); // 120 итог
    if (calc.lines.educationSelf > 0) pen.money(calc.lines.educationSelf, X, 112, 12); // 130
  }

  // --- Приложение 5, лист 2: лечение, страхование, итоги, ИИС -------------------
  function fillApp5b(pen) {
    const X = 365.9;
    if (calc.lines.medicalOrdinary > 0) pen.money(calc.lines.medicalOrdinary, X, 716, 12); // 140
    if (calc.lines.insurance > 0) pen.money(calc.lines.insurance, X, 570, 12); // 160
    pen.money(ap.socialGroup, X, 450, 12); // 180 итог с ограничением 219.2
    const social = ap.socialGroup + ap.childEducation + ap.expensiveMedical;
    pen.money(social, X, 371, 12); // 190 все социальные
    pen.money(social, X, 344, 12); // 200 стандартные + социальные
    if (ap.iis > 0) pen.money(ap.iis, X, 303, 12); // 210 ИИС (ст. 219.1)
  }

  // --- Приложение 7: имущественный вычет ---------------------------------------
  function fillApp7(pen) {
    const pr = model.property;
    pen.left(pr.codes.object, 156.2, 699, 1); // 010 код наименования объекта
    pen.left(pr.codes.sign, 354.6, 699, 2); // 020 признак налогоплательщика
    if (pr.codes.build) pen.left(pr.codes.build, 354.6, 674, 1); // 030 способ (дом)
    if (pr.cadastral) pen.left(pr.cadastral, 14.5, 646, 40); // 032 кадастровый №
    else fillRows(pen, pr.address, 14.5, [610, 586, 563, 540, 517, 493, 470], 40); // 033
    pen.date(pr.dateAct, 425.5, 445); // 040 дата акта о передаче
    pen.date(pr.dateReg, 425.5, 421); // 050 дата регистрации права
    pen.money(Math.min(pr.cost, 2_000_000), 425.5, 396, 8); // 080 расходы (≤ лимита)
    if (pr.interestPaid > 0) pen.money(pr.interestPaid, 425.5, 369, 8); // 090 проценты
    if (pr.priorDeduction > 0) pen.money(pr.priorDeduction, 425.5, 336, 8); // 100
    if (pr.priorInterest > 0) pen.money(pr.priorInterest, 425.5, 312, 8); // 110
    // 140 — налоговая база за минусом прочих вычетов (стандартных, соц., ИИС)
    const otherDeductions =
      ap.socialGroup + ap.childEducation + ap.expensiveMedical + ap.iis;
    pen.money(Math.max(0, calc.totalIncome - otherDeductions), 368.8, 199, 12);
    pen.money(ap.property, 425.5, 176, 8); // 150 расходы за отчётный год
    if (ap.interest > 0) pen.money(ap.interest, 425.5, 146, 8); // 160 проценты за год
    pen.money(calc.carryover.property, 425.5, 116, 8); // 170 остаток расходов
    pen.money(calc.carryover.interest, 425.5, 93, 8); // 180 остаток процентов
  }
}
