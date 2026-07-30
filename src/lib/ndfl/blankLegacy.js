// Декларации за 2022–2024 годы на подлинных бланках ФНС.
//
//  - 2022: приказ ФНС от 29.09.2022 № ЕД-7-11/880@ (штрихкоды 0331 90xx);
//  - 2023: приказ ФНС от 15.10.2021 № ЕД-7-11/903@ в ред. от 11.09.2023
//    № ЕД-7-11/615@ (штрихкоды 0332 00xx);
//  - 2024: приказ ФНС от 19.09.2024 № ЕД-7-11/757@ (штрихкоды 0332 10xx).
//
// Бланки 2022/2023 — официальные сканы с сайта ФНС (300 dpi, пересобраны без
// постороннего текстового слоя), 2024 — векторный оригинал ФНС. Координаты
// знакомест извлечены программно (вектор — pdfminer, скан — детекция точек
// пунктира); шаг клетки во всех редакциях — 14.17 pt (5 мм). Движок печати —
// blankPdf.js. Отличия старых форм от 2025 (913@):
//  - на титуле заполняются дата рождения и паспорт (код 21, серия и номер);
//  - в заявлении к Разделу 1 есть «Вид счёта» (код 02 — текущий);
//  - Раздел 2: «код вида дохода» = 10, есть строки 061–063 и 081;
//  - Приложение 1: код вида дохода = 07 (2 знакоместа);
//  - Приложение 7 (2022/2023): «код номера объекта» 031 и номер объекта 032
//    вместо способа приобретения.
import blank2022Url from "../../assets/ndfl/blank-2022.pdf?url";
import blank2023Url from "../../assets/ndfl/blank-2023.pdf?url";
import blank2024Url from "../../assets/ndfl/blank-2024.pdf?url";
import { assembleOnBlank, fillRows, chunk } from "./blankPdf.js";
import { CODES } from "./refs.js";
import { digits } from "../format.js";

// Индексы страниц внутри blank-20XX.pdf (порядок задан при нарезке бланков).
// app6 (доходы от продажи) добавлен восьмой страницей в бланки с продажей;
// raschet (Расчёт к Приложению 1, недвижимость) — девятой, где он есть.
const PG = { title: 0, r1: 1, r1app: 2, r2: 3, app1: 4, app5a: 5, app5b: 6, app7: 7, app6: 8, raschet: 9 };

// --- Координатные карты (pt, левый нижний угол; см. docs/fns-blank-2025.md) --
// Формы 2022 и 2023 сверстаны одинаково, кроме листа 1 Приложения 5
// (редакция 615@ изменила состав строк) — карта общая, лист 5а — по годам.
const MAP_22_23 = {
  title: {
    corr: [91.0, 715], period: [216.2, 715], year: [337.6, 715], ifns: [524.8, 715],
    country: [85.3, 659], category: [340.4, 659],
    fio: [[85.3, 630], [85.3, 604], [85.3, 578]],
    birth: [85.3, 550], docCode: [127.8, 498], docSerial: [127.8, 472],
    status: [184.6, 440], phone: [156.1, 410], pages: [133.6, 266], confirm: [34.3, 216],
  },
  r1: { kbk: 678, oktmo: 652, pay: 624, refund: 597, x: 295.1 },
  r1app: { sum: [181.7, 695], bik: [295.1, 655], kind: [110.8, 629], account: [295.1, 629] },
  r2: {
    x: 351.7, code: 708,
    money: { "010": 682, "020": 658, "030": 629, "040": 600, "050": 571, "060": 547, "061": 518, "062": 468, "063": 419 },
    ints: { "070": 371, "080": 347, "081": 322, "090": 270, 100: 241, 120: 213, 130: 174, 140: 145, 150: 115, 160: 90, 170: 66 },
  },
  app1: {
    codeX: 119.4, rateX: 527.5, codeY: [720, 504, 289],
    innX: 14.5, kppX: 227.0, oktmoX: 400.4, idY: [684, 468, 253],
    nameY: [[648, 624, 601, 577], [432, 408, 385, 362], [217, 194, 169, 146]],
    sumY: [540, 324, 108], taxX: 298.0,
  },
  app5b: { 130: 696, 140: 666, 160: 491, 180: 347, 190: 276, 200: 247, 210: 204 },
  // Приложение 6 (доходы от продажи) формы 903@/615@ — лист из
  // КонсультантПлюс-рендера (штрихкод 0332 0129, та же редакция, что и скан).
  // У этой формы нет строки 115 → своя вертикальная развёрстка; координаты
  // строк 070/080/160 сняты пиксельным сравнением рядов знакомест с бланком
  // 2024 (offset −5.2 / −5.2 / +4.6 pt). Строки жилья 010/020 — тем же offset
  // −5.2 от бланка 2024 (y010 678.4→673.2, y020 652.9→647.7), сверено рендером.
  app6: { x: 422.7, y010: 673.2, y020: 647.7, y070: 489.0, y080: 463.5, y160: 52.5 },
  // Расчёт к Приложению 1 (недвижимость), лист официальной машиночитаемой формы
  // ФНС 2023 (v5.18, штрихкод 0332 0150), врезан 9-й страницей. Верстка как у
  // 757@; координаты сняты рендером страницы 300 dpi.
  raschet: { cadNum: [14.2, 714.6], cadX: 14.2, docX: 334.8, rub: 13, yTop: 633.8, yBot: 580.4 },
  app7: {
    obj: [159.0, 705], sign: [357.4, 705], numCode: [468.0, 682], build: [227.0, 682],
    cadastralY: [652, 631], addressY: [594, 571, 548, 525, 502, 478, 455],
    dateAct: [122.2, 430], dateReg: [439.7, 430],
    x: 425.5, cost: 370, interest: 342, prior: 309, priorInt: 285,
    base: [368.8, 155], claim: 131, claimInt: 102, rest: 72, restInt: 48,
  },
};

const MAPS = {
  2022: {
    blankUrl: blank2022Url, ...MAP_22_23,
    app5a: { 100: 293, 110: 253, 120: 223 },
  },
  2023: {
    blankUrl: blank2023Url, ...MAP_22_23,
    app5a: { 100: 272, 110: 231, 120: 201 },
  },
  2024: {
    blankUrl: blank2024Url,
    title: {
      corr: [91.0, 717], period: [215.7, 717], year: [337.6, 717], ifns: [524.7, 717],
      country: [85.3, 662], category: [340.4, 662],
      fio: [[85.3, 633], [85.3, 607], [85.3, 581]],
      birth: [85.3, 552], docCode: [127.8, 500], docSerial: [127.8, 474],
      status: [184.5, 411], phone: [156.2, 382], pages: [133.5, 265], confirm: [34.3, 215],
    },
    r1: { kbk: 672, oktmo: 645, pay: 619, refund: 592, x: 295.1 },
    r1app: { sum: [181.7, 690], bik: [295.1, 649], kind: [110.8, 623], account: [295.1, 623] },
    r2: {
      x: 351.8, code: 710,
      money: { "010": 683, "020": 659, "030": 630, "040": 602, "050": 573, "060": 548, "061": 520, "062": 469, "063": 422 },
      ints: { "070": 374, "080": 349, "081": 324, "090": 274, 100: 245, 120: 216, 130: 177, 140: 148, 150: 119, 160: 94, 170: 69 },
    },
    app1: {
      codeX: 119.3, rateX: 527.5, codeY: [714, 498, 283],
      innX: 14.5, kppX: 227.1, oktmoX: 400.0, idY: [678, 462, 247],
      nameY: [[642, 618, 595, 572], [426, 403, 380, 356], [211, 187, 164, 141]],
      sumY: [533, 318, 102], taxX: 297.9,
    },
    app5a: { 100: 301, 110: 209, 120: 183, 130: 123 },
    app5b: { 140: 716, 160: 550, 180: 411, 190: 317, 200: 288, 210: 242 },
    // Приложение 7 формы 757@ свёрстано как в 913@ (сверено по сеткам).
    app7: {
      obj: [156.2, 699], sign: [354.6, 699], build: [354.6, 674],
      cadastralY: [646], addressY: [610, 586, 563, 540, 517, 493, 470],
      dateAct: [425.5, 445], dateReg: [425.5, 421],
      x: 425.5, cost: 396, interest: 369, prior: 336, priorInt: 312,
      base: [368.8, 199], claim: 176, claimInt: 146, rest: 116, restInt: 93,
    },
    // Приложение 6 (доходы от продажи) формы 757@ свёрстано как в 913@:
    // координаты строк совпали с бланком 2025 (сверено pdfminer). Строки жилья
    // 010/020 (пункт 1) — как в 2025.
    app6: { x: 422.7, y010: 678.4, y020: 652.9, y070: 494.2, y080: 468.7, y160: 64.9 },
    // Расчёт к Приложению 1 (недвижимость), лист 757@ штрихкод 0332 1157. В
    // отличие от 913@ строки-признака нет (плоский ДохПродОНИ): 010 —
    // кадастровый номер; 020 — кадастровая стоимость (левый столбец) и 030 —
    // доход по цене договора (правый) в одном ряду; 040 — кадастр × коэф.
    // (левый) и 050 — доход к налогообложению (правый) в следующем ряду.
    // Денежные X/точки — как на других листах (сверено pdfminer, offset +6,4).
    raschet: { cadNum: [14.2, 714.6], cadX: 14.2, docX: 334.8, rub: 13, yTop: 633.8, yBot: 580.4 },
  },
};

export async function buildOfficialPdfLegacy(model) {
  const M = MAPS[model.year];
  if (!M) throw new Error(`Нет карты бланка для года ${model.year}`);
  const { person, calc } = model;
  const ap = calc.applied;
  const sale = model.sale;

  // Продажа: без заявления о возврате, Приложение 1 — покупатель, плюс
  // Приложение 6. Возврат: как раньше.
  const sheets = sale
    ? [
        { tpl: PG.title, fill: fillTitle },
        { tpl: PG.r1, fill: fillR1 },
        { tpl: PG.r2, fill: fillR2 },
        { tpl: PG.app1, fill: fillApp1Sale },
        { tpl: PG.app6, fill: fillApp6 },
        // Недвижимость: лист «Расчёт к Приложению 1» (есть в бланках с raschet).
        ...(sale.kind === "realty" && M.raschet ? [{ tpl: PG.raschet, fill: fillRaschet }] : []),
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

  // В сканах 2022/2023 линия «Фамилия» в шапке выше, чем в векторных бланках.
  const headerBase = model.year <= 2023 ? 770.3 : 764.5;
  return assembleOnBlank({ blankUrl: M.blankUrl, person, sheets, headerBase });

  // --- Титульный лист: в старых формах паспорт и дата рождения заполняются ----
  function fillTitle(pen) {
    const T = M.title;
    pen.left(String(Number(model.correction) || 0), ...T.corr, 3); // 0 — первичная, 1+ — уточнённая
    pen.left(CODES.period, ...T.period, 2);
    pen.left(String(model.year), ...T.year, 4);
    pen.left(person.ifns, ...T.ifns, 4);
    pen.left(CODES.country, ...T.country, 3);
    pen.left(CODES.taxpayerCategory, ...T.category, 3);
    pen.left(person.lastName, ...T.fio[0], 35);
    pen.left(person.firstName, ...T.fio[1], 35);
    pen.left(person.middleName, ...T.fio[2], 35);
    pen.date(person.birthDate, ...T.birth);
    // Паспорт не обязателен при указанном ИНН (2024+): код вида документа
    // без серии и номера на титуле выглядел бы как ошибка — не печатаем.
    if (person.passport.series || person.passport.number) {
      pen.left(person.passport.code, ...T.docCode, 2); // 21 — паспорт РФ
      pen.left(`${person.passport.series} ${person.passport.number}`, ...T.docSerial, 25);
    }
    pen.left(CODES.status, ...T.status, 1);
    pen.left(digits(person.phone), ...T.phone, 20);
    pen.left(String(total).padStart(3, "0"), ...T.pages, 3);
    pen.left("1", ...T.confirm, 1);
  }

  // --- Раздел 1 ----------------------------------------------------------------
  function fillR1(pen) {
    pen.left(model.kbk, M.r1.x, M.r1.kbk, 20); // 020
    pen.left(person.oktmo, M.r1.x, M.r1.oktmo, 11); // 030
    pen.int(sale ? model.owed : 0, M.r1.x, M.r1.pay, 13); // 040 к уплате
    pen.int(sale ? 0 : model.refund, M.r1.x, M.r1.refund, 13); // 050 к возврату
  }

  // --- Приложение к Разделу 1: заявление о возврате -----------------------------
  function fillR1App(pen) {
    pen.money(model.refund, ...M.r1app.sum, 13); // 010 в размере
    pen.left(model.bank.bik, ...M.r1app.bik, 9); // 020 БИК
    pen.left(model.bank.kind, ...M.r1app.kind, 2); // 030 вид счёта — 02
    pen.left(model.bank.account, ...M.r1app.account, 20); // 040 номер счёта
  }

  // --- Раздел 2 ------------------------------------------------------------------
  function fillR2(pen) {
    const { x, code, money, ints } = M.r2;
    // Продажа: код вида дохода «10» (основная база), суммы из sale, налог
    // печатается в строку 150 «к уплате». Возврат: как раньше (строка 160).
    const income = sale ? sale.taxable : calc.totalIncome;
    const base = sale ? sale.base : calc.taxBase;
    pen.left(sale ? sale.groupCode : CODES.incomeKind, x, code, 2); // 001
    const mv = {
      "010": income, "020": 0, "030": income,
      "040": sale ? sale.deduction : calc.totalDeduction, "050": 0, "060": base,
      "061": base, "062": 0, "063": 0, // база по ставке абз. 2 п. 1 ст. 224
    };
    for (const [k, y] of Object.entries(money)) pen.money(mv[k] ?? 0, x, y, 13);
    const iv = {
      "070": sale ? sale.tax : calc.assessed,
      "080": sale ? 0 : calc.totalWithheld,
      "150": sale ? model.owed : 0,
      "160": sale ? 0 : model.refund,
    };
    for (const [k, y] of Object.entries(ints)) pen.int(iv[k] ?? 0, x, y, 13);
  }

  // --- Приложение 1: до трёх источников дохода на листе --------------------------
  function fillApp1(pen, incomes) {
    const A = M.app1;
    incomes.forEach((inc, i) => {
      pen.left("07", A.codeX, A.codeY[i], 2); // код вида дохода — 07 (зарплата)
      pen.right(String(model.ratePercent), A.rateX, A.codeY[i], 2);
      pen.left(inc.inn, A.innX, A.idY[i], 12);
      pen.left(inc.kpp, A.kppX, A.idY[i], 9);
      pen.left(inc.oktmo, A.oktmoX, A.idY[i], 11);
      fillRows(pen, inc.name, A.innX, A.nameY[i], 40);
      pen.money(inc.income, A.innX, A.sumY[i], 13); // 070
      pen.int(inc.withheld, A.taxX, A.sumY[i], 13); // 080
    });
  }

  // --- Приложение 1 (продажа): источник дохода — покупатель --------------------
  function fillApp1Sale(pen) {
    const A = M.app1, b = sale.buyer;
    pen.left(sale.incomeCode, A.codeX, A.codeY[0], 2); // 010 код вида дохода — 18 (продажа имущества)
    pen.right(String(model.ratePercent), A.rateX, A.codeY[0], 2);
    if (b.inn.length === 12) pen.left(b.inn, A.innX, A.idY[0], 12); // ИНН физлица
    pen.left(person.oktmo, A.oktmoX, A.idY[0], 11); // ОКТМО по месту жительства
    fillRows(pen, b.name || "Физическое лицо", A.innX, A.nameY[0], 40);
    pen.money(sale.price, A.innX, A.sumY[0], 13); // 070 сумма дохода
    pen.int(0, A.taxX, A.sumY[0], 13); // 080 налог удержан — 0
  }

  // --- Приложение 6: имущественный вычет по доходам от продажи -----------------
  // Жильё/земля (пункт 1): строка 010 (вычет 1 млн ₽) / 020 (расходы); авто и
  // иное движимое (пункт 3): 070 (вычет 250 тыс) / 080 (расходы). 160 — итог.
  function fillApp6(pen) {
    const A = M.app6;
    const expenses = sale.deductionKind === "expenses";
    if (sale.kind === "realty") {
      if (expenses) pen.money(sale.deduction, A.x, A.y020, 8); // 020 расходы
      else pen.money(sale.deduction, A.x, A.y010, 8); // 010 вычет 1 млн
    } else {
      if (expenses) pen.money(sale.deduction, A.x, A.y080, 8); // 080 расходы
      else pen.money(sale.deduction, A.x, A.y070, 8); // 070 вычет 250 тыс
    }
    pen.money(sale.deduction, A.x, A.y160, 8); // 160 общая сумма вычетов
  }

  // --- Расчёт к Приложению 1 (недвижимость) -----------------------------------
  // Плоская структура форм до 2025 (без строки-признака): 010 кадастровый
  // номер; ряд yTop: 020 кадастровая стоимость (левый) + 030 доход по договору
  // (правый); ряд yBot: 040 кадастр × коэф. (левый) + 050 доход к
  // налогообложению (правый). Кадастровую стоимость требуем на шаге «Продажа».
  function fillRaschet(pen) {
    const R = M.raschet;
    pen.left(sale.cadastralNumber, R.cadNum[0], R.cadNum[1], 40); // 010
    pen.money(sale.cadastral, R.cadX, R.yTop, R.rub); // 020 кадастровая стоимость
    pen.money(sale.price, R.docX, R.yTop, R.rub); // 030 доход по цене договора
    pen.money(sale.cadastralTaxable, R.cadX, R.yBot, R.rub); // 040 кадастр × 0,7
    pen.money(sale.taxable, R.docX, R.yBot, R.rub); // 050 доход к налогообложению
  }

  // --- Приложение 5, лист 1 -------------------------------------------------------
  function fillApp5a(pen) {
    const X = 365.9, A = M.app5a;
    if (ap.childEducation > 0) pen.money(ap.childEducation, X, A[100], 12); // 100
    if (ap.expensiveMedical > 0) pen.money(ap.expensiveMedical, X, A[110], 12); // 110
    pen.money(ap.childEducation + ap.expensiveMedical, X, A[120], 12); // 120 итог
    // В форме 757@ (2024) строка 130 «своё обучение» — на листе 1.
    if (A[130] && calc.lines.educationSelf > 0)
      pen.money(calc.lines.educationSelf, X, A[130], 12);
  }

  // --- Приложение 5, лист 2 -------------------------------------------------------
  function fillApp5b(pen) {
    const X = 365.9, A = M.app5b;
    // В формах 880@/903@ (2022/2023) строка 130 — на листе 2.
    if (A[130] && calc.lines.educationSelf > 0)
      pen.money(calc.lines.educationSelf, X, A[130], 12);
    if (calc.lines.medicalOrdinary > 0) pen.money(calc.lines.medicalOrdinary, X, A[140], 12); // 140
    if (calc.lines.insurance > 0) pen.money(calc.lines.insurance, X, A[160], 12); // 160
    pen.money(ap.socialGroup, X, A[180], 12); // 180 итог с ограничением 219 НК
    const social = ap.socialGroup + ap.childEducation + ap.expensiveMedical;
    pen.money(social, X, A[190], 12); // 190 все социальные
    pen.money(social, X, A[200], 12); // 200 стандартные + социальные
    if (ap.iis > 0) pen.money(ap.iis, X, A[210], 12); // 210 ИИС
  }

  // --- Приложение 7: имущественный вычет -------------------------------------------
  function fillApp7(pen) {
    const pr = model.property, A = M.app7;
    pen.left(pr.codes.object, ...A.obj, 1); // 010 код наименования объекта
    pen.left(pr.codes.sign, ...A.sign, 2); // 020 признак налогоплательщика
    if (pr.codes.build) pen.left(pr.codes.build, ...A.build, 1); // 030 способ (дом)
    if (A.numCode) {
      // 2022/2023: 031 код номера объекта (1 — кадастровый, 2 — нет номера)
      pen.left(pr.cadastral ? "1" : "2", ...A.numCode, 1);
    }
    if (pr.cadastral) fillRows(pen, pr.cadastral, 14.5, A.cadastralY, 40); // 032
    else fillRows(pen, pr.address, 14.5, A.addressY, 40); // 033 местонахождение
    pen.date(pr.dateAct, ...A.dateAct); // 040 дата акта о передаче
    pen.date(pr.dateReg, ...A.dateReg); // 050 дата регистрации права
    pen.money(Math.min(pr.cost, 2_000_000), A.x, A.cost, 8); // 080
    if (pr.interestPaid > 0) pen.money(pr.interestPaid, A.x, A.interest, 8); // 090
    if (pr.priorDeduction > 0) pen.money(pr.priorDeduction, A.x, A.prior, 8); // 100
    if (pr.priorInterest > 0) pen.money(pr.priorInterest, A.x, A.priorInt, 8); // 110
    // 140 — налоговая база за минусом прочих вычетов
    const otherDeductions =
      ap.socialGroup + ap.childEducation + ap.expensiveMedical + ap.iis;
    pen.money(Math.max(0, calc.totalIncome - otherDeductions), ...A.base, 12);
    pen.money(ap.property, A.x, A.claim, 8); // 150 за отчётный год
    if (ap.interest > 0) pen.money(ap.interest, A.x, A.claimInt, 8); // 160
    pen.money(calc.carryover.property, A.x, A.rest, 8); // 170 остаток
    pen.money(calc.carryover.interest, A.x, A.restInt, 8); // 180 остаток процентов
  }
}
