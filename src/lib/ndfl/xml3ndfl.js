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

// Структура файла НО_НДФЛ3 сверена с официальными XSD-схемами ФНС
// (docs/fns-schemas/, версии 5.17–5.20) через npm run validate:xml.
export function buildDeclarationXml(model) {
  const { person, calc, year } = model;
  const rules = yearRules(year);
  const guid = crypto.randomUUID().toUpperCase();
  const stamp = isoToday().replace(/-/g, "");
  const fileId = `NO_NDFL3_${person.ifns}_${person.ifns}_${person.inn}_${stamp}_${guid}`;

  const social = model.social;
  const ap = calc.applied;
  const pr = model.property;
  const sale = model.sale; // продажа имущества (налог к уплате, Приложение 6)
  // Строки формы: суммы налога — целые рубли (xs:integer), суммы дохода и
  // вычетов — рубли с копейками (xs:decimal 15.2).
  const kop2 = (n) => kop(n);
  const grp219 = ap.socialGroup; // лечение обычное + своё обучение + страхование (лимит года)
  const socialTotalApplied = ap.socialGroup + ap.childEducation + ap.expensiveMedical;

  // Форма менялась по годам — три семейства схем (сверено с XSD ФНС):
  const isOld = year <= 2023; // 2022–2023: идентификация через СведФЛ1, Прил7 без ДатаРегОб
  const is2025 = year >= 2025; // 2025: ГрупДоход вместо ВидДоход, урезанные наборы полей, счёт без ВидСч

  // Блок идентификации налогоплательщика внутри НПФЛ3 (после ФИОФЛ).
  const identity = isOld
    ? el(
        "СведФЛ1",
        // В СведФЛ1 ИНН, дата рождения и гражданство — атрибуты; паспорт — вложенный УдЛичн.
        { ИННФЛ: person.inn, ДатаРожд: dateRu(person.birthDate), ОКСМ: CODES.country },
        el("УдЛичн", {
          КодВидДок: person.passport.code,
          СерНомДок: `${person.passport.series} ${person.passport.number}`,
        })
      )
    : el("ИННФЛ", {}, person.inn);

  const xml =
    `<?xml version="1.0" encoding="windows-1251"?>` +
    el(
      "Файл",
      { ИдФайл: fileId, ВерсПрог: "Nalog-Service 1.0", ВерсФорм: rules.xmlVersion },
      el(
        "Документ",
        {
          КНД: "1151020",
          ДатаДок: dateRu(isoToday()),
          Период: CODES.period,
          ОтчетГод: String(year),
          КодНО: person.ifns,
          // 0 — первичная, 1+ — уточнённая. Строго строкой: el() отбрасывает
          // пустые значения, а атрибут по XSD обязателен.
          НомКорр: String(Number(model.correction) || 0),
        },
        // Сведения о налогоплательщике
        el(
          "СвНП",
          {},
          el(
            "НПФЛ3",
            { ДокПредст: CODES.taxpayerCategory, Статус: CODES.status, Тлф: person.phone || undefined },
            el("ФИОФЛ", {
              Фамилия: person.lastName,
              Имя: person.firstName,
              Отчество: person.middleName || undefined,
            }),
            identity
          )
        ),
        el("Подписант", { ПрПодп: "1" }),
        el(
          "НДФЛ3",
          {},
          // --- Раздел 1: суммы налога к уплате/возврату ---
          el(
            "СумНалПу",
            {},
            el("СумНалПуИскл227", {
              КБК: model.kbk,
              ОКТМО: person.oktmo,
              ПодлУпл: sale ? rub(model.owed) : "0",
              ПодлВозв: sale ? "0" : rub(model.refund),
            })
          ),
          // Заявление о возврате (распоряжение положительным сальдо ЕНС)
          model.refund > 0 &&
            el(
              "ЗаявРаспДС",
              { Сумма: kop2(model.refund) },
              el("СвСчБанк", {
                БИК: model.bank.bik,
                // Вид счёта убран из формата с 2025 года.
                ВидСч: is2025 ? undefined : model.bank.kind,
                НомСч: model.bank.account,
              })
            ),
          // --- Раздел 2: расчёт базы и налога ---
          // Продажа: отдельная группа доходов (2025 — «02»), налог к УПЛАТЕ.
          sale
            ? el(
                "НалБаза",
                // 2025 — ГрупДоход «02»; до 2025 — ВидДоход «10» (основная база).
                is2025 ? { ГрупДоход: sale.groupCode } : { ВидДоход: sale.groupCode },
                el("РасчНалБаза", {
                  СумДох: kop2(sale.taxable),
                  СумДохНеНал: "0.00",
                  СумДохНал: kop2(sale.taxable),
                  СумНалВыч: kop2(sale.deduction),
                  СумРасх: "0.00",
                  НалБаза: kop2(sale.base),
                  // Поля прогрессивной базы/иного — только до 2025 (как в возврате).
                  "НалБаза2.1.224": is2025 ? undefined : "0.00",
                  "НалБаза3.1.224": is2025 ? undefined : "0.00",
                  СумИное: is2025 ? undefined : "0.00",
                }),
                el("РасчНалПУ", {
                  Исчисл: rub(sale.tax),
                  Удерж: "0",
                  СумУдержИст224: is2025 ? undefined : "0", // убрано с 2025
                  СумУдержМат: "0",
                  ТСУплПерЗач: "0",
                  СумФиксАван: "0",
                  УплИнПодлЗач: "0",
                  УплПатентЗач: "0",
                  ПодлУпл: rub(model.owed),
                  ПодлВозв: "0",
                  СумВозвУпр: "0",
                })
              )
            : el(
                "НалБаза",
                // ГрупДоход (группа доходов) с 2025 года заменил ВидДоход.
                is2025 ? { ГрупДоход: "01" } : { ВидДоход: "10" },
                el("РасчНалБаза", {
                  СумДох: kop2(calc.totalIncome),
                  СумДохНеНал: "0.00",
                  СумДохНал: kop2(calc.totalIncome),
                  СумНалВыч: kop2(calc.totalDeduction),
                  СумРасх: "0.00",
                  НалБаза: kop2(calc.taxBase),
                  // Эти три поля есть только до 2025 года.
                  "НалБаза2.1.224": is2025 ? undefined : "0.00",
                  "НалБаза3.1.224": is2025 ? undefined : "0.00",
                  СумИное: is2025 ? undefined : "0.00",
                }),
                el("РасчНалПУ", {
                  Исчисл: rub(calc.assessed),
                  Удерж: rub(calc.totalWithheld),
                  СумУдержИст224: is2025 ? undefined : "0", // убрано с 2025
                  СумУдержМат: "0",
                  ТСУплПерЗач: "0",
                  СумФиксАван: "0",
                  УплИнПодлЗач: "0",
                  УплПатентЗач: "0",
                  ПодлУпл: "0",
                  ПодлВозв: rub(model.refund),
                  СумВозвУпр: "0",
                })
              ),
          // --- Приложение 1: доходы от источников в РФ ---
          // Продажа: источник дохода — покупатель (физлицо, ИстФЛИн), код вида
          // дохода «018» (продажа иного имущества), ОКТМО — по месту жительства.
          ...(sale
            ? [
                el(
                  "ДоходИстРФ",
                  {
                    ВидДоход: sale.incomeCode,
                    Ставка: String(model.ratePercent),
                    ОКТМО: person.oktmo,
                    Доход: kop2(sale.price),
                    НалУдерж: "0",
                  },
                  // Покупатель — физлицо (типовой случай частной продажи авто):
                  // ФИО обязательно, ИНН физлица (12 цифр) — по желанию. Если
                  // введён 10-значный ИНН организации, его не пишем (для ИстЮЛ
                  // нужен КПП, который продавец не знает) — остаётся ФИО/название.
                  el("ИстФЛИн", {
                    ФИОИн: sale.buyer.name || "Физическое лицо",
                    ИННФЛ: sale.buyer.inn.length === 12 ? sale.buyer.inn : undefined,
                  })
                ),
              ]
            : model.incomes.map((inc) =>
                el(
                  "ДоходИстРФ",
                  {
                    // Код вида дохода: 2 цифры до 2025, 3 цифры с 2025.
                    ВидДоход: is2025 ? "010" : "07",
                    Ставка: String(model.ratePercent),
                    ОКТМО: inc.oktmo,
                    Доход: kop2(inc.income),
                    НалУдерж: rub(inc.withheld),
                  },
                  el("ИстЮЛ", { Наим: inc.name, ИННЮЛ: inc.inn, КПП: inc.kpp })
                )
              )),
          // --- Приложение 5: стандартные/социальные/инвестиционные вычеты ---
          social &&
            el(
              "ВычСтандСоц",
              { ВычСтандСоц: kop2(socialTotalApplied) },
              // Стандартные — у нас нет, но блок обязателен.
              el("РасчВычСтанд", { ОбщВычСтандДекл: "0.00" }),
              // Соц. вычеты без ограничения (обучение детей, дорогостоящее лечение)
              (ap.childEducation > 0 || ap.expensiveMedical > 0) &&
                el("РасчВычСоцБез219.2", {
                  СумОбуч: ap.childEducation > 0 ? kop2(ap.childEducation) : undefined,
                  СумЛечен: ap.expensiveMedical > 0 ? kop2(ap.expensiveMedical) : undefined,
                  ИтогВычСоциал: kop2(ap.childEducation + ap.expensiveMedical),
                }),
              // Соц. вычеты с ограничением (своё обучение, обычное лечение,
              // страхование, физкультурно-оздоровительные услуги)
              grp219 > 0 &&
                el("РасчВычСоц219.2", {
                  СумОбуч: calc.lines.educationSelf > 0 ? kop2(calc.lines.educationSelf) : undefined,
                  СумМедУсл: calc.lines.medicalOrdinary > 0 ? kop2(calc.lines.medicalOrdinary) : undefined,
                  СумЛичСтрах: calc.lines.insurance > 0 ? kop2(calc.lines.insurance) : undefined,
                  СумФиз: calc.lines.sport > 0 ? kop2(calc.lines.sport) : undefined,
                  ОбщВычСоциал: kop2(grp219),
                }),
              // Инвестиционный вычет по взносам на ИИС (тип А)
              ap.iis > 0 &&
                el("РасчИнвВыч", {
                  СумИнвВыч219: kop2(ap.iis),
                  ИнвВычПредВосст: "0.00",
                  ИнвВычУпр: "0.00",
                })
            ),
          // --- Приложение 6: имущественный вычет по доходам от продажи ---
          // ОбщИмущВыч (стр. 160) — итоговая сумма вычета. Дочерний элемент по
          // типу имущества: жилая недвижимость и земля (пункт 1) — ВычДохНедвЖил
          // (ВычПродИмущ — вычет 1 млн ₽ / РасхПриобИмущ — расходы); авто и иное
          // движимое (пункт 3) — ВычПродИмущИн (ВычДохПродИмущ — вычет 250 тыс ₽
          // / РасхПриобрИмущ — расходы). Имена атрибутов различаются (сверено с
          // XSD: тип СвСумПр6 у иного имущества, inline-атрибуты у жилья).
          sale &&
            el(
              "ИмущНалВычПр",
              { ОбщИмущВыч: kop2(sale.deduction) },
              sale.kind === "realty"
                ? el(
                    "ВычДохНедвЖил",
                    sale.deductionKind === "expenses"
                      ? { РасхПриобИмущ: kop2(sale.deduction) }
                      : { ВычПродИмущ: kop2(sale.deduction) }
                  )
                : el(
                    "ВычПродИмущИн",
                    sale.deductionKind === "expenses"
                      ? { РасхПриобрИмущ: kop2(sale.deduction) }
                      : { ВычДохПродИмущ: kop2(sale.deduction) }
                  )
            ),
          // --- Приложение 7: имущественный вычет по приобретению жилья ---
          pr &&
            el(
              "ИмущНалВычНов",
              {},
              el(
                "РасчИмущВыч",
                {
                  ВычНАУпр: ap.property > 0 ? kop2(ap.property) : undefined,
                  РасхНовВычНД: ap.property > 0 ? kop2(ap.property) : undefined,
                  ПроцВычНД: ap.interest > 0 ? kop2(ap.interest) : undefined,
                  ОстИВБезПроц: kop2(calc.carryover.property),
                  ОстИВУплПроц: kop2(calc.carryover.interest),
                },
                el(
                  "СвОбъектРасх",
                  {
                    КодНаимОб: pr.codes.object,
                    ПризнакНП: pr.codes.sign,
                    // Дата регистрации права появилась в СвОбъектРасх с 2024 года.
                    ДатаРегОб: !isOld && pr.dateReg ? dateRu(pr.dateReg) : undefined,
                    СумРасхФакт: pr.cost > 0 ? kop2(Math.min(pr.cost, 2_000_000)) : undefined,
                    СумФактУплПроц: pr.interestPaid > 0 ? kop2(pr.interestPaid) : undefined,
                  },
                  el("СведОбъект", {
                    // До 2024 объект задаётся кодом номера + номером.
                    КодНомерОб: isOld ? (pr.cadastral ? "1" : "4") : undefined,
                    НомерОб: pr.cadastral || "0",
                    // Способ приобретения — только для жилых домов (строка 030
                    // формы); атрибут опционален в схемах всех лет.
                    СпособПриобр: pr.codes.build || undefined,
                  })
                )
              )
            ),
          // --- Расчёт к Приложению 1: сверка дохода с кадастровой стоимостью ---
          // Только недвижимость (ст. 214.10 НК). Элемент ДохПродОНИ — прямой
          // потомок НДФЛ3, по порядку XSD идёт после ИмущНалВычНов (Прил. 7) и
          // ДохОперЦБ. До 2025 атрибуты лежат прямо на ДохПродОНИ; с 2025 — на
          // вложенном ДохОНИ с признаком ВидДох ("1" — доход определён с учётом
          // кадастра). Кадастровую стоимость требуем на шаге «Продажа», поэтому
          // все обязательные поля (в форме до 2025 обязательны все пять) есть.
          sale &&
            sale.kind === "realty" &&
            (() => {
              const cad = {
                НомКадОтчуждОНИ: sale.cadastralNumber || "0",
                КадСтоимГодРег: kop2(sale.cadastral),
                ДохПродЦенаДог: kop2(sale.price),
                КадСтоимКоэф: kop2(sale.cadastralTaxable),
                ДохПродНалОбл: kop2(sale.taxable),
              };
              return is2025
                ? el("ДохПродОНИ", {}, el("ДохОНИ", { ВидДох: "1", ...cad }))
                : el("ДохПродОНИ", cad);
            })()
        )
      )
    );

  return {
    filename: `${fileId}.xml`,
    bytes: encodeCp1251(xml),
    verified: Boolean(rules.xmlVerified),
  };
}
