// Пересборка официального бланка 3-НДФЛ за 2025 год под приказ ФНС
// от 25.05.2026 № ЕД-1-11/333@ (в силе с 01.09.2026).
//
// Что делает приказ и что делает этот скрипт:
//   * п. 1.1.1 — на 13 листах заменены ТОЛЬКО штрихкоды, вёрстка не тронута.
//     Такие листы остаются векторными (как были), поверх старого штрихкода
//     штампуется новый — вырезка из официального машиночитаемого шаблона.
//   * п. 1.1.2 — Приложение 5 изложено в новой редакции. Лист 1 совпал с
//     прежним (сдвиг < 1 pt), поэтому ему тоже хватает замены штрихкода.
//     Лист 2 перевёрстан: строки уехали на 2–10 pt, поэтому он заменяется
//     страницей официального шаблона целиком (растр 300 dpi).
//     Координаты печати для него правятся в src/lib/ndfl/blank2025.js.
//
// Вход: машиночитаемый шаблон ФНС 1151020_5.21000_28.tif (16 листов),
// скачивается вручную — из облака format.nalog.ru отдаёт 503, см.
// docs/fns-schemas/README.md. Путь передаётся первым аргументом.
//
// Запуск: node scripts/build-blank-2025.mjs <шаблон.tif|.pdf> [выход.pdf]
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { PDFDocument } from "pdf-lib";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSET = join(ROOT, "src/assets/ndfl/blank-2025.pdf");

// Наш лист (индекс в PG, blank2025.js) → страница шаблона (1-based).
// Сопоставление подтверждено штрихкодами, а не порядком следования.
const MAP = [
  { pg: 0, tpl: 1,  name: "Титульный лист",        code: "0332 3014" },
  { pg: 1, tpl: 2,  name: "Раздел 1",              code: "0332 3021" },
  { pg: 2, tpl: 3,  name: "Прил. к Разделу 1",     code: "0332 3038" },
  { pg: 3, tpl: 4,  name: "Раздел 2",              code: "0332 3045" },
  { pg: 4, tpl: 5,  name: "Приложение 1",          code: "0332 3052" },
  { pg: 5, tpl: 10, name: "Приложение 5, лист 1",  code: "0332 3106" },
  { pg: 6, tpl: 11, name: "Приложение 5, лист 2",  code: "0332 3113", full: true },
  { pg: 7, tpl: 13, name: "Приложение 7",          code: "0332 3137" },
  { pg: 8, tpl: 12, name: "Приложение 6",          code: "0332 3120" },
  { pg: 9, tpl: 15, name: "Расчёт к Приложению 1", code: "0332 3151" },
];

// Зона штрихкода в пунктах PDF (замерена по самому бланку: штрихкод и
// цифры под ним, реперные квадраты и поле ИНН не задеваются).
const BC = { x0: 42, x1: 126, y0: 786, y1: 832 };
const PAGE_W = 595.275, PAGE_H = 841.889;

async function main() {
  const [tplPath, outPath = ASSET] = process.argv.slice(2);
  if (!tplPath) {
    console.error("Укажите путь к шаблону ФНС (.tif или .pdf)");
    process.exit(1);
  }
  const tmp = await mkdtemp(join(tmpdir(), "blank-"));
  try {
    // TIF → PDF: pdftoppm умеет только PDF, а шаблон ФНС приходит в TIFF.
    let tplPdf = tplPath;
    if (/\.tiff?$/i.test(tplPath)) {
      tplPdf = join(tmp, "tpl.pdf");
      await run("tiff2pdf", ["-o", tplPdf, tplPath]);
    }

    const doc = await PDFDocument.load(await readFile(ASSET));
    if (doc.getPageCount() !== MAP.length)
      throw new Error(`в ассете ${doc.getPageCount()} стр., ожидалось ${MAP.length}`);

    for (const s of MAP) {
      if (s.full) continue; // страницу целиком меняем отдельно, ниже
      // Вырезаем зону штрихкода из шаблона в 600 dpi — штрихкод должен
      // остаться читаемым сканером после печати.
      const pref = join(tmp, `bc${s.pg}`);
      await run("pdftoppm", ["-png", "-r", "600", "-f", String(s.tpl), "-l", String(s.tpl),
        "-x", String(Math.round(BC.x0 / 72 * 600)),
        "-y", String(Math.round((PAGE_H - BC.y1) / 72 * 600)),
        "-W", String(Math.round((BC.x1 - BC.x0) / 72 * 600)),
        "-H", String(Math.round((BC.y1 - BC.y0) / 72 * 600)),
        tplPdf, pref]);
      const png = await readFile(`${pref}-${String(s.tpl).padStart(2, "0")}.png`);
      const img = await doc.embedPng(png);
      const page = doc.getPage(s.pg);
      // Забеливаем старый штрихкод и кладём новый на то же место.
      page.drawRectangle({ x: BC.x0, y: BC.y0, width: BC.x1 - BC.x0, height: BC.y1 - BC.y0,
        color: { type: "RGB", red: 1, green: 1, blue: 1 } });
      page.drawImage(img, { x: BC.x0, y: BC.y0, width: BC.x1 - BC.x0, height: BC.y1 - BC.y0 });
      console.log(`  ${s.name}: штрихкод → ${s.code}`);
    }

    // Приложение 5, лист 2 — страница из шаблона целиком (вёрстка изменилась).
    // Копируем страницу как есть, не перегоняя через картинку: в шаблоне она
    // лежит в CCITT G4 (~50 КБ), а растеризация в PNG раздувала ассет втрое.
    const s2 = MAP.find((m) => m.full);
    const tplDoc = await PDFDocument.load(await readFile(tplPdf));
    const [copied] = await doc.copyPages(tplDoc, [s2.tpl - 1]);
    doc.removePage(s2.pg);
    doc.insertPage(s2.pg, copied);
    // Размер страницы шаблона (595.2×841.92) на сотые доли пункта отличается
    // от остальных листов — приводим к общему, иначе съедет печать.
    doc.getPage(s2.pg).setSize(PAGE_W, PAGE_H);
    console.log(`  ${s2.name}: страница заменена целиком, штрихкод → ${s2.code}`);

    await writeFile(outPath, await doc.save());
    console.log(`\nГотово: ${outPath}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
