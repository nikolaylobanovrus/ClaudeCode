// Электронное представление декларации (файл обмена НО_НДФЛ3) для загрузки
// в Личный кабинет ФНС. Кодировка — windows-1251, имя файла по маске
// NO_NDFL3_{ИФНС}_{ИФНС}_{ИНН}_{ГГГГММДД}_{GUID}.xml.
// ВНИМАНИЕ: ЛК ФНС жёстко проверяет файл по XSD актуального приказа —
// функция помечена в интерфейсе как «бета», основной документ — PDF.
import { CODES, yearRules } from "./refs.js";
import { fmtDate as dateRu } from "./model.js";

const kop = (n) => (Math.max(0, Number(n) || 0)).toFixed(2);
const rub = (n) => String(Math.max(0, Math.round(Number(n) || 0)));

// Экранирование значений атрибутов.
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Элемент: el("Тег", {атрибуты}, ...дети) → строка.
function el(name, attrs = {}, ...children) {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  const kids = children.filter(Boolean).join("");
  return kids ? `<${name}${a}>${kids}</${name}>` : `<${name}${a}/>`;
}

// Кодировщик windows-1251: кириллица занимает непрерывный блок 0xC0–0xFF,
// отдельно Ё/ё и №. TextEncoder cp1251 не поддерживает — пишем сами.
// Итерация по code point'ам (for..of), а не по code unit'ам: эмодзи и прочие
// символы вне BMP дают ОДИН «?», а не пару мусорных байтов.
export function encodeCp1251(str) {
  const bytes = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code <= 0x7f) bytes.push(code);
    else if (code >= 0x0410 && code <= 0x044f) bytes.push(code - 0x0410 + 0xc0); // А..я
    else if (code === 0x0401) bytes.push(0xa8); // Ё
    else if (code === 0x0451) bytes.push(0xb8); // ё
    else if (code === 0x2116) bytes.push(0xb9); // №
    else if (code === 0x00ab) bytes.push(0xab); // «
    else if (code === 0x00bb) bytes.push(0xbb); // »
    else if (code === 0x2013 || code === 0x2014) bytes.push(0x2d); // тире → дефис
    else bytes.push(0x3f); // прочее → "?"
  }
  return Uint8Array.from(bytes);
}

const isoToday = () => new Date().toISOString().slice(0, 10);

export function buildDeclarationXml(model) {
  const { person, calc, year } = model;
  const rules = yearRules(year);
  const guid = crypto.randomUUID().toUpperCase();
  const stamp = isoToday().replace(/-/g, "");
  const fileId = `NO_NDFL3_${person.ifns}_${person.ifns}_${person.inn}_${stamp}_${guid}`;
  const version = rules.xmlVersion;

  const xml =
    `<?xml version="1.0" encoding="windows-1251"?>` +
    el(
      "Файл",
      // ВерсПрог — обязательный атрибут корня (версия программы-формирователя).
      { ИдФайл: fileId, ВерсПрог: "Nalog-Service 1.0", ВерсФорм: version, ТипИнф: "НО_НДФЛ3" },
      el(
        "Документ",
        {
          КНД: "1151020",
          ДатаДок: dateRu(isoToday()),
          Период: CODES.period,
          ОтчетГод: String(year),
          КодНО: person.ifns,
          НомКорр: "0",
          ПоМесту: CODES.taxpayerCategory,
        },
        el(
          "СвНП",
          { ОКТМО: person.oktmo, Тлф: person.phone },
          el(
            "НПФЛ",
            {
              ИННФЛ: person.inn,
              СтатусФЛ: CODES.status,
              ДатаРожд: dateRu(person.birthDate),
              МестоРожд: person.birthPlace,
              Гражд: "643",
            },
            el("ФИО", {
              Фамилия: person.lastName,
              Имя: person.firstName,
              Отчество: person.middleName,
            }),
            el("УдЛичнФЛ", {
              КодВидДок: person.passport.code,
              СерНомДок: `${person.passport.series} ${person.passport.number}`,
              ДатаДок: dateRu(person.passport.date),
              ВыдДок: person.passport.issuer,
            })
          )
        ),
        el("Подписант", { ПрПодп: "1" }),
        el(
          "НДФЛ3",
          {},
          el(
            "Раздел1",
            {},
            el("СведНал", {
              КодРез: "2",
              КБК: model.kbk,
              ОКТМО: person.oktmo,
              НалУпл: "0",
              НалВозвр: rub(model.refund),
            }),
            el(
              "ЗаявВозвр",
              { НомЗаяв: "1", СумВозвр: rub(model.refund) },
              el("СведСчет", {
                БИК: model.bank.bik,
                ВидСчета: model.bank.kind,
                НомСчета: model.bank.account,
              })
            )
          ),
          el("Раздел2", {
            КодВидДох: CODES.incomeKind,
            СумДохОбщ: kop(calc.totalIncome),
            СумДохОблаг: kop(calc.totalIncome),
            СумВычет: kop(calc.totalDeduction),
            НалБаза: kop(calc.taxBase),
            НалИсчисл: rub(calc.assessed),
            НалУдерж: rub(calc.totalWithheld),
            НалВозвр: rub(model.refund),
          }),
          el(
            "Прил1",
            {},
            ...model.incomes.map((inc) =>
              el("ИстДохРФ", {
                КодВидДох: CODES.incomeKind,
                Ставка: String(model.ratePercent),
                ИННИст: inc.inn,
                КППИст: inc.kpp,
                ОКТМОИст: inc.oktmo,
                НаимИст: inc.name,
                СумДоход: kop(inc.income),
                НалУдерж: rub(inc.withheld),
              })
            )
          ),
          // Значения «применённые» (см. calc.js) — суммы Приложения 5
          // сходятся с СумВычет Раздела 2 по контрольным соотношениям.
          model.social &&
            el("Прил5", {
              ОбучДет: rub(calc.applied.childEducation),
              ЛечДорог: rub(calc.applied.expensiveMedical),
              ОбучСвое: rub(calc.lines.educationSelf),
              Лечение: rub(calc.lines.medicalOrdinary),
              СтрахЖизн: rub(calc.lines.insurance),
              СоцВычОгр: rub(calc.applied.socialGroup),
              СоцВычОбщ: rub(
                calc.applied.socialGroup +
                  calc.applied.childEducation +
                  calc.applied.expensiveMedical
              ),
              ВычИИС: rub(calc.applied.iis),
            }),
          model.property &&
            el(
              "Прил7",
              {},
              el("ПриобрИмущ", {
                КодНаимОбъекта: "2",
                ПризнНП: "01",
                КодНомОбъекта: model.property.cadastral ? "1" : "4",
                НомОбъекта: model.property.cadastral,
                АдресОбъекта: model.property.address,
                ДатаАкт: dateRu(model.property.dateAct),
                ДатаРегИмущ: dateRu(model.property.dateReg),
                СтоимОбъекта: rub(Math.min(model.property.cost, 2_000_000)),
                СумПроц: rub(model.property.interestPaid),
                ВычПредРасх: rub(model.property.priorDeduction),
                ВычПредПроц: rub(model.property.priorInterest),
                ВычГодРасх: rub(calc.applied.property),
                ВычГодПроц: rub(calc.applied.interest),
                ОстВычРасх: rub(calc.carryover.property),
                ОстВычПроц: rub(calc.carryover.interest),
              })
            )
        )
      )
    );

  return {
    filename: `${fileId}.xml`,
    bytes: encodeCp1251(xml),
    verified: Boolean(rules.xmlVerified),
  };
}
