// Печать декларации за 2025 год на ПОДЛИННОМ бланке ФНС.
//
// Страницы официального машиночитаемого бланка (приказ ФНС от 20.10.2025
// № ЕД-7-11/913@, форма КНД 1151020) встраиваются в документ как есть — со
// штрихкодами, реперными квадратами и сеткой знакомест, — а значения
// печатаются моноширинным шрифтом точно в клетки, как это делает ПО ФНС.
// Бланк — официальный документ государственного органа и не является
// объектом авторского права (ст. 1259 ГК РФ).
//
// Координаты знакомест извлечены программно из официального PDF ФНС:
// единицы — пункты (pt), начало координат — левый нижний угол листа,
// шаг клетки 14.17 pt (5 мм), высота ряда 17 pt.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import blankUrl from "../../assets/ndfl/blank-2025.pdf?url";
import monoUrl from "../../assets/fonts/LiberationMono-Bold.ttf?url";
import { CODES } from "./refs.js";
import { digits } from "../format.js";

const CELL = 14.17; // шаг знакоместа
const A4 = [595.275, 841.889];
const BLACK = rgb(0, 0, 0);
const SIZE = 10.5; // кегль значений в клетках

// Индексы страниц внутри blank-2025.pdf (порядок задан при нарезке бланка).
const PG = { title: 0, r1: 1, r1app: 2, r2: 3, app1: 4, app5a: 5, app5b: 6, app7: 7 };

// Бланк и шрифт грузятся один раз на сессию (как шрифты в pdfPage.js).
let assetsPromise = null;
function loadAssets() {
  assetsPromise ||= Promise.all(
    [blankUrl, monoUrl].map((u) => fetch(u).then((r) => r.arrayBuffer()))
  );
  return assetsPromise;
}

// Деньги: рубли и копейки раздельно (в формах они в разных группах клеток).
const rubKop = (n) => {
  const v = Math.max(0, Number(n) || 0);
  return { rub: String(Math.trunc(v)), kop: String(Math.round((v % 1) * 100)).padStart(2, "0") };
};

// «Перо» одной страницы: печать символов по знакоместам.
function makePen(page, font) {
  const put = (ch, x, y) => {
    const w = font.widthOfTextAtSize(ch, SIZE);
    page.drawText(ch, { x: x + (CELL - w) / 2, y: y + 4.9, size: SIZE, font, color: BLACK });
  };
  return {
    // Текст слева направо (коды, ИНН, КБК, ФИО и т.п.), капсом — как в форме.
    left(text, x, y, n) {
      const chars = [...String(text ?? "").toUpperCase()].slice(0, n);
      chars.forEach((ch, i) => ch !== " " && put(ch, x + i * CELL, y));
    },
    // Числа с выравниванием по правому знакоместу (порядок заполнения ФНС
    // для программной печати).
    right(text, x, y, n) {
      const chars = [...String(text ?? "")].slice(-n);
      const off = n - chars.length;
      chars.forEach((ch, i) => ch !== " " && put(ch, x + (off + i) * CELL, y));
    },
    // Сумма «руб . коп»: рубли вправо к напечатанной в бланке точке,
    // копейки — в две клетки за ней (слот точки шириной в одну клетку).
    money(n, x, y, rubCells) {
      const { rub, kop } = rubKop(n);
      this.right(rub, x, y, rubCells);
      this.left(kop, x + (rubCells + 1) * CELL, y, 2);
    },
    // Целые рубли без копеечной части.
    int(n, x, y, cells) {
      this.right(String(Math.max(0, Math.round(Number(n) || 0))), x, y, cells);
    },
    // Дата дд.мм.гггг: группы 2/2/4 клетки, между ними слоты под точки.
    date(iso, x, y) {
      if (!iso) return;
      const [Y, M, D] = String(iso).split("-");
      if (!Y || !M || !D) return;
      this.left(D, x, y, 2);
      this.left(M, x + 3 * CELL, y, 2);
      this.left(Y, x + 6 * CELL, y, 4);
    },
    // Обычный текст вне знакомест (фамилия и инициалы в шапке листов).
    text(str, x, y, size = SIZE) {
      page.drawText(String(str), { x, y, size, font, color: BLACK });
    },
  };
}

// Длинный текст по рядам клеток (наименование источника, адрес объекта).
function fillRows(pen, text, x, rowsY, cellsPerRow) {
  const up = String(text || "").toUpperCase().replace(/\s+/g, " ").trim();
  let rest = up;
  for (const y of rowsY) {
    if (!rest) break;
    pen.left(rest.slice(0, cellsPerRow), x, y, cellsPerRow);
    rest = rest.slice(cellsPerRow).trimStart();
  }
}

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function buildOfficialPdf2025(model) {
  const [blankBytes, monoBytes] = await loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const mono = await doc.embedFont(monoBytes, { subset: true });

  const { person, calc } = model;
  const ap = calc.applied;

  // --- Состав листов ---------------------------------------------------------
  const sheets = [
    { tpl: PG.title, fill: fillTitle },
    { tpl: PG.r1, fill: fillR1 },
    { tpl: PG.r1app, fill: fillR1App },
    { tpl: PG.r2, fill: fillR2 },
  ];
  for (const part of chunk(model.incomes, 3))
    sheets.push({ tpl: PG.app1, fill: (pen) => fillApp1(pen, part) });
  if (model.social) {
    sheets.push({ tpl: PG.app5a, fill: fillApp5a });
    sheets.push({ tpl: PG.app5b, fill: fillApp5b });
  }
  if (model.property) sheets.push({ tpl: PG.app7, fill: fillApp7 });
  const total = sheets.length;

  // Каждый уникальный лист бланка встраивается один раз и переиспользуется.
  const uniq = [...new Set(sheets.map((s) => s.tpl))];
  const embedded = await doc.embedPdf(blankBytes, uniq);
  const tplPage = new Map(uniq.map((idx, i) => [idx, embedded[i]]));

  sheets.forEach((sheet, i) => {
    const page = doc.addPage(A4);
    page.drawPage(tplPage.get(sheet.tpl));
    const pen = makePen(page, mono);
    // Шапка каждого листа: ИНН; со 2-го листа — номер страницы (на титуле
    // «001» предпечатан в бланке) и «Фамилия И. О.» на линиях.
    pen.left(person.inn, 184.5, 810, 12);
    if (i > 0) {
      pen.left(String(i + 1).padStart(3, "0"), 340.4, 788, 3);
      pen.text((person.lastName || "").toUpperCase(), 103, 764.5, 10);
      if (person.firstName) pen.text(person.firstName[0].toUpperCase() + ".", 472, 764.5, 10);
      if (person.middleName) pen.text(person.middleName[0].toUpperCase() + ".", 529, 764.5, 10);
    }
    sheet.fill(pen);
  });

  return doc.save();

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

  // --- Раздел 1: налог к возврату ---------------------------------------------
  function fillR1(pen) {
    pen.left(model.kbk, 295.1, 672, 20); // 020 КБК
    pen.left(person.oktmo, 295.1, 645, 11); // 030 ОКТМО
    pen.int(0, 295.1, 619, 13); // 040 к уплате
    pen.int(model.refund, 295.1, 592, 13); // 050 к возврату
  }

  // --- Приложение к Разделу 1: заявление о возврате (ст. 79 НК) ---------------
  function fillR1App(pen) {
    pen.money(model.refund, 210.1, 690, 13); // 010 в размере
    pen.left(model.bank.bik, 210.1, 649, 9); // 020 БИК
    pen.left(model.bank.account, 210.1, 623, 20); // 030 номер счёта
  }

  // --- Раздел 2: налоговая база и сумма налога ---------------------------------
  function fillR2(pen) {
    const X = 351.8;
    pen.left("01", X, 710, 2); // 001 код группы доходов
    pen.money(calc.totalIncome, X, 683, 13); // 010 доходы
    pen.money(0, X, 659, 13); // 020 не облагаемые
    pen.money(calc.totalIncome, X, 630, 13); // 030 облагаемые
    pen.money(calc.totalDeduction, X, 602, 13); // 040 вычеты
    pen.money(0, X, 573, 13); // 050 расходы
    pen.money(calc.taxBase, X, 548, 13); // 060 налоговая база
    pen.int(calc.assessed, X, 495, 13); // 070 исчислено
    pen.int(calc.totalWithheld, X, 470, 13); // 080 удержано
    pen.int(0, X, 445, 13); // 090 матвыгода
    pen.int(0, X, 416, 13); // 100 торговый сбор
    pen.int(0, X, 388, 13); // 120 авансовые
    pen.int(0, X, 348, 13); // 130 за рубежом
    pen.int(0, X, 319, 13); // 140 патент
    pen.int(0, X, 290, 13); // 150 к уплате
    pen.int(model.refund, X, 265, 13); // 160 к возврату
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
    pen.left("2", 156.2, 699, 1); // 010 объект — квартира
    pen.left("01", 354.6, 699, 2); // 020 признак — собственник
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
