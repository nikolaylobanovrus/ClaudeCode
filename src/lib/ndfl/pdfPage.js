// Низкоуровневые помощники pdf-lib для листов декларации: знакоместа
// (клетки под символы), шапка листа с ИНН и номером страницы, подписи.
// Модуль загружается лениво (см. StepDocuments) — pdf-lib и шрифты не
// попадают в основной бандл сайта.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontRegularUrl from "../../assets/fonts/LiberationSans-Regular.ttf?url";
import fontBoldUrl from "../../assets/fonts/LiberationSans-Bold.ttf?url";

export const mm = (v) => v * 2.834645669;
export const A4 = { w: 595.28, h: 841.89 };
export const MARGIN = mm(12);

const INK = rgb(0.1, 0.12, 0.16);
const FRAME = rgb(0.45, 0.5, 0.58);
const MUTED = rgb(0.45, 0.48, 0.55);

export async function createDoc() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all(
    [fontRegularUrl, fontBoldUrl].map((u) => fetch(u).then((r) => r.arrayBuffer()))
  );
  const font = await doc.embedFont(reg, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });
  return { doc, font, fontBold };
}

// Ряд знакомест: рамки клеток + символы (по одному на клетку).
export function drawCells(page, font, text, x, yTop, count, opts = {}) {
  const { cellW = mm(4.6), cellH = mm(5.6), size = 9.5, align = "left" } = opts;
  const chars = [...String(text ?? "")].slice(0, count);
  const startIndex = align === "right" ? count - chars.length : 0;
  for (let i = 0; i < count; i++) {
    const cx = x + i * cellW;
    page.drawRectangle({
      x: cx,
      y: yTop - cellH,
      width: cellW,
      height: cellH,
      borderColor: FRAME,
      borderWidth: 0.6,
    });
    const ch = chars[i - startIndex];
    if (ch && ch !== " ") {
      const w = font.widthOfTextAtSize(ch, size);
      page.drawText(ch, {
        x: cx + (cellW - w) / 2,
        y: yTop - cellH + (cellH - size) / 2 + 1,
        size,
        font,
        color: INK,
      });
    }
  }
  return x + count * cellW;
}

// Лист декларации с курсором сверху вниз и штатной шапкой.
export function makeSheet(ctx, { inn, pageNo, formTitle, sheetTitle }) {
  const page = ctx.doc.addPage([A4.w, A4.h]);
  const sheet = {
    page,
    y: A4.h - MARGIN,
    x: MARGIN,
    width: A4.w - MARGIN * 2,

    advance(h) {
      this.y -= h;
    },

    text(str, { size = 9, bold = false, x = this.x, color = INK, maxWidth } = {}) {
      const f = bold ? ctx.fontBold : ctx.font;
      // Перенос длинных строк по ширине листа.
      const words = String(str).split(" ");
      let line = "";
      const lines = [];
      const limit = maxWidth || this.width - (x - this.x);
      for (const w of words) {
        const probe = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(probe, size) > limit && line) {
          lines.push(line);
          line = w;
        } else line = probe;
      }
      if (line) lines.push(line);
      for (const l of lines) {
        this.y -= size + 3;
        page.drawText(l, { x, y: this.y, size, font: f, color });
      }
    },

    h2(str) {
      this.advance(6);
      this.text(str, { size: 10.5, bold: true });
      this.advance(3);
    },

    // Поле «подпись сверху + знакоместа»: label мелко, под ним клетки.
    field(label, value, count, opts = {}) {
      const x = opts.x ?? this.x;
      if (label) {
        this.y -= 8;
        page.drawText(label, { x, y: this.y, size: 7, font: ctx.font, color: MUTED });
        this.y -= 2;
      }
      drawCells(page, ctx.font, value, x, this.y, count, opts);
      this.y -= (opts.cellH ?? mm(5.6)) + 4;
    },

    // Несколько полей в одну строку: [{label, value, count, align}]
    fieldsRow(items, opts = {}) {
      const gap = opts.gap ?? mm(6);
      const cellW = opts.cellW ?? mm(4.6);
      const cellH = opts.cellH ?? mm(5.6);
      let x = this.x;
      const yLabel = this.y - 8;
      const yCells = yLabel - 2;
      for (const it of items) {
        page.drawText(it.label, { x, y: yLabel, size: 7, font: ctx.font, color: MUTED });
        drawCells(page, ctx.font, it.value, x, yCells, it.count, {
          cellW,
          cellH,
          align: it.align,
        });
        x += it.count * cellW + gap;
      }
      this.y = yCells - cellH - 4;
    },

    // Строка формы: «Код строки | подпись ..... | значение в клетках справа».
    line(code, label, value, count = 14) {
      const cellW = mm(4.2);
      const cellH = mm(5.2);
      const cellsX = this.x + this.width - count * cellW;
      const rowH = cellH + 3;
      this.y -= rowH;
      if (code)
        page.drawText(code, { x: this.x, y: this.y + 2, size: 8, font: ctx.fontBold, color: INK });
      page.drawText(label, {
        x: this.x + (code ? mm(12) : 0),
        y: this.y + 2,
        size: 8,
        font: ctx.font,
        color: INK,
        maxWidth: cellsX - this.x - mm(14),
      });
      drawCells(page, ctx.font, value, cellsX, this.y + cellH, count, {
        cellW,
        cellH,
        align: "right",
      });
      this.y -= 2;
    },

    divider() {
      this.y -= 6;
      page.drawLine({
        start: { x: this.x, y: this.y },
        end: { x: this.x + this.width, y: this.y },
        thickness: 0.6,
        color: FRAME,
      });
      this.y -= 2;
    },

    note(str) {
      this.text(str, { size: 7.5, color: MUTED });
    },
  };

  // --- Шапка листа: ИНН + номер страницы, названия формы и листа -------------
  const headY = sheet.y;
  page.drawText("ИНН", { x: sheet.x, y: headY - 12, size: 8, font: ctx.font, color: INK });
  drawCells(page, ctx.font, inn, sheet.x + mm(10), headY - 4, 12);
  const strX = sheet.x + sheet.width - mm(4.6) * 3 - mm(12);
  page.drawText("Стр.", { x: strX - mm(2), y: headY - 12, size: 8, font: ctx.font, color: INK });
  drawCells(page, ctx.font, String(pageNo).padStart(3, "0"), strX + mm(7), headY - 4, 3);
  sheet.y = headY - mm(5.6) - 10;

  if (formTitle) {
    sheet.text(formTitle, { size: 11, bold: true });
    sheet.advance(2);
  }
  if (sheetTitle) {
    sheet.text(sheetTitle, { size: 9.5, bold: true });
    sheet.advance(2);
  }
  sheet.divider();

  return sheet;
}

// Подвал каждого листа: происхождение документа. Дисклеймер обязателен —
// это реплика формы без машиночитаемых штрихкодов (см. план/README).
export function drawFooter(sheet, ctx, textOverride) {
  const str =
    textOverride ||
    "Сформировано сервисом «Налог-сервис» по образцу формы КНД 1151020. Для подачи онлайн используйте Личный кабинет ФНС.";
  sheet.page.drawText(str, {
    x: MARGIN,
    y: mm(8),
    size: 6.5,
    font: ctx.font,
    color: MUTED,
  });
}

// Блок «Достоверность и полноту сведений подтверждаю» с местом подписи.
export function drawSignature(sheet, ctx, fio) {
  sheet.advance(10);
  sheet.text("Достоверность и полноту сведений, указанных в настоящей декларации, подтверждаю:", {
    size: 8,
  });
  sheet.advance(6);
  sheet.text(fio, { size: 9, bold: true });
  sheet.advance(14);
  const y = sheet.y;
  const x = sheet.x;
  sheet.page.drawLine({
    start: { x, y },
    end: { x: x + mm(45), y },
    thickness: 0.7,
    color: INK,
  });
  sheet.page.drawLine({
    start: { x: x + mm(60), y },
    end: { x: x + mm(105), y },
    thickness: 0.7,
    color: INK,
  });
  sheet.page.drawText("(подпись)", { x: x + mm(15), y: y - 9, size: 7, font: ctx.font, color: MUTED });
  sheet.page.drawText("(дата)", { x: x + mm(78), y: y - 9, size: 7, font: ctx.font, color: MUTED });
  sheet.y = y - 16;
}
