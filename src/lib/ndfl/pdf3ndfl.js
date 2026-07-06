// Декларация 3-НДФЛ (форма КНД 1151020) — PDF в браузере.
//
// Все поддерживаемые годы печатаются на ПОДЛИННЫХ бланках ФНС: страницы
// официальных PDF со штрихкодами и знакоместами + значения моноширинным
// шрифтом точно в клетках — вид совпадает с выгрузкой из ПО налоговой.
//  - 2025+: приказ от 20.10.2025 № ЕД-7-11/913@ (blank2025.js);
//  - 2022–2024: приказы 880@ / 903@ (ред. 615@) / 757@ (blankLegacy.js).
// Движок печати и происхождение бланков: blankPdf.js, docs/fns-blank-2025.md.
import { buildOfficialPdf2025 } from "./blank2025.js";
import { buildOfficialPdfLegacy } from "./blankLegacy.js";

export async function buildDeclarationPdf(model) {
  return model.year >= 2025
    ? buildOfficialPdf2025(model)
    : buildOfficialPdfLegacy(model);
}
