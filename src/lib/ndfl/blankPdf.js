// Общий движок печати декларации на подлинных бланках ФНС.
//
// Страницы официального бланка (PDF ФНС) встраиваются в документ как есть,
// значения печатаются моноширинным шрифтом точно в знакоместа — как в ПО
// налоговой. Координаты — в пунктах, начало — левый нижний угол листа,
// шаг клетки 14.17 pt (5 мм). Карты полей по годам: blank2025.js (913@)
// и blankLegacy.js (880@, 903@ ред. 615@, 757@).
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import monoUrl from "../../assets/fonts/LiberationMono-Bold.ttf?url";

export const CELL = 14.17; // шаг знакоместа
const A4 = [595.275, 841.889];
const BLACK = rgb(0, 0, 0);
const SIZE = 10.5; // кегль значений в клетках

// Байты бланков и шрифта грузятся один раз на сессию.
const assetCache = new Map();
export function loadAsset(url) {
  if (!assetCache.has(url))
    assetCache.set(url, fetch(url).then((r) => r.arrayBuffer()));
  return assetCache.get(url);
}

// Деньги: рубли и копейки раздельно (в форме они по разные стороны точки).
const rubKop = (n) => {
  const v = Math.max(0, Number(n) || 0);
  return { rub: String(Math.trunc(v)), kop: String(Math.round((v % 1) * 100)).padStart(2, "0") };
};

// «Перо» одной страницы: печать символов по знакоместам.
export function makePen(page, font) {
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
export function fillRows(pen, text, x, rowsY, cellsPerRow) {
  const up = String(text || "").toUpperCase().replace(/\s+/g, " ").trim();
  let rest = up;
  for (const y of rowsY) {
    if (!rest) break;
    pen.left(rest.slice(0, cellsPerRow), x, y, cellsPerRow);
    rest = rest.slice(cellsPerRow).trimStart();
  }
}

export const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Сборка документа: страницы бланка + заполнение. sheets: [{tpl, fill(pen)}],
// tpl — индекс страницы внутри файла бланка. Шапка каждого листа (ИНН, номер
// страницы, «Фамилия И. О.») одинакова во всех редакциях формы; на титуле
// «Стр. 001» предпечатан в бланке.
export async function assembleOnBlank({ blankUrl, person, sheets, headerBase = 764.5 }) {
  const [blankBytes, monoBytes] = await Promise.all([loadAsset(blankUrl), loadAsset(monoUrl)]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const mono = await doc.embedFont(monoBytes, { subset: true });

  // Каждый уникальный лист бланка встраивается один раз и переиспользуется.
  const uniq = [...new Set(sheets.map((s) => s.tpl))];
  const embedded = await doc.embedPdf(blankBytes, uniq);
  const tplPage = new Map(uniq.map((idx, i) => [idx, embedded[i]]));

  sheets.forEach((sheet, i) => {
    const page = doc.addPage(A4);
    page.drawPage(tplPage.get(sheet.tpl));
    const pen = makePen(page, mono);
    pen.left(person.inn, 184.5, 810, 12);
    if (i > 0) {
      pen.left(String(i + 1).padStart(3, "0"), 340.4, 787.6, 3);
      pen.text((person.lastName || "").toUpperCase(), 103, headerBase, 10);
      if (person.firstName) pen.text(person.firstName[0].toUpperCase() + ".", 472, headerBase, 10);
      if (person.middleName) pen.text(person.middleName[0].toUpperCase() + ".", 529, headerBase, 10);
    }
    sheet.fill(pen);
  });

  return doc.save();
}
