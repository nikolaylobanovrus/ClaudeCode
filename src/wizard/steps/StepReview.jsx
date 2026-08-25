// Шаг «Проверка»: сводка введённого и расчёт (возврат ИЛИ налог к уплате).
// calc приходит из WizardShell — расчёт выполняется один раз на рендер.
import { useWizard } from "../WizardContext.jsx";
import { wizardDeductions, stepsFor, stepIndexIn } from "../../data/wizard.js";
import { yearRules, SALE_OBJECTS } from "../../lib/ndfl/refs.js";

// Что именно продали — одной строкой на объект.
const objectLabelOf = (o) =>
  SALE_OBJECTS.find((x) => x.value === (o.objectKind || "auto"))?.label ||
  (o.kind === "realty" ? "Недвижимость" : "Автомобиль или иное движимое имущество");
// Несколько объектов — перечисляем через запятую: в сводке важно, что именно
// декларируется, а не только сумма.
const saleObjectsLabel = (sale) => sale.items.map(objectLabelOf).join(", ");
import { fmtRub } from "../../lib/format.js";
import { ymGoal } from "../../lib/metrika.js";

export default function StepReview({ calc, errors = {} }) {
  const { draft, dispatch } = useWizard();
  const p = draft.personal;
  const goto = (key) => dispatch({ type: "GOTO", step: stepIndexIn(stepsFor(draft), key) });
  // Реквизиты доходов, отложенные на шаге «Доходы», спрашиваются здесь:
  // дальше — документы, ФНС требует все поля. Не тупик, а лестница: те же
  // три пути (фото/ЛК ФНС/вручную) прямо из проверки.
  const incomeGaps = Object.keys(errors).some(
    (k) => k.startsWith("income.") || k === "incomes"
  );

  // Чистая продажа: сводка и налог к уплате (Приложение 6), без возврата.
  // У комбинированной декларации разметка возвратная — продажа в ней идёт
  // отдельным блоком ниже, потому что вычеты и счёт тоже надо показать.
  if (calc.sale && !calc.mixed) {
    const s = calc.sale;
    const saleRows = [
      ["Отчётный год", draft.year, "types"],
      ...s.items.flatMap((o, i) => {
        const n = s.items.length > 1 ? ` (объект ${i + 1})` : "";
        return [
          [`Что продали${n}`, objectLabelOf(o), "sale"],
          [`Цена продажи${n}`, fmtRub(o.price), "sale"],
          ...(o.kind === "realty"
            ? [
                [`Кадастровый номер${n}`, o.cadastralNumber || "—", "sale"],
                [`Кадастровая стоимость${n}`, fmtRub(o.cadastral), "sale"],
              ]
            : []),
          [
            o.deductionKind === "expenses" ? `Расходы на покупку${n}` : `Вычет${n}`,
            fmtRub(o.deduction),
            "sale",
          ],
          [`Покупатель${n}`, o.buyer.name || "—", "sale"],
        ];
      }),
      ["ФИО", [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" "), "personal"],
      ["ИНН", p.inn, "personal"],
      ["Инспекция / ОКТМО", `${p.ifns} / ${p.oktmo}`, "personal"],
    ];
    return (
      <div>
        <dl className="cabinet__list wiz__summary">
          {saleRows.map(([label, value, step]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {value || "—"}{" "}
                <button type="button" className="wiz__edit" onClick={() => goto(step)}>
                  изменить
                </button>
              </dd>
            </div>
          ))}
        </dl>

        <div className="wiz__calc">
          <h3 className="wiz__subhead">Расчёт налога</h3>
          <div className="wiz__calc-row">
            <span>Доход от {s.items.length > 1 ? "всех продаж" : "продажи"}</span>
            <span>{fmtRub(s.taxable)}</span>
          </div>
          <div className="wiz__calc-row">
            <span>Вычеты и расходы</span>
            <span>−{fmtRub(s.deduction)}</span>
          </div>
          <div className="wiz__calc-row wiz__calc-row--total">
            <span>Налог к уплате</span>
            <span>{fmtRub(calc.owed)}</span>
          </div>
          <p className="wiz__note">
            Мы подготовим декларацию. Налог платится отдельно в вашу инспекцию —
            срок уплаты за {draft.year} год до 15 июля {Number(draft.year) + 1} года.
          </p>
        </div>

        {calc.warnings.map((w) => (
          <div className="doc-note doc-note--err" key={w}>
            {w}
          </div>
        ))}
      </div>
    );
  }

  const rows = [
    ["Отчётный год", draft.year, "types"],
    ...(Number(draft.correction) > 0
      ? [["Тип декларации", `Уточнённая, корректировка № ${draft.correction}`, "types"]]
      : []),
    [
      "Вычеты",
      draft.types
        .map((t) => wizardDeductions.find((d) => d.slug === t)?.title || t)
        .join("; "),
      "types",
    ],
    ["ФИО", [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" "), "personal"],
    ["ИНН", p.inn, "personal"],
    ["Инспекция / ОКТМО", `${p.ifns} / ${p.oktmo}`, "personal"],
    ["Доход за год", fmtRub(calc.totalIncome), "income"],
    ["Налог удержан", fmtRub(calc.totalWithheld), "income"],
    ...(calc.mixed
      ? [
          ["Продали", saleObjectsLabel(calc.sale), "sale"],
          ["Цена продажи", fmtRub(calc.sale.price), "sale"],
        ]
      : []),
    ["Счёт для возврата", `${draft.bank.bik} / ${draft.bank.account}`, "bank"],
  ];

  // Социальные вычеты показываем ПОСТРОЧНО, а не одной строкой «лечение,
  // обучение, страхование, спорт»: основание вычета — то, что проверяет
  // налоговая, и подмена (например, обучение заявлено как лечение) должна
  // быть видна человеку до выдачи документов. Суммы — из calc.lines,
  // это ровно те значения, что уйдут в строки 130/140/160/171 Прил. 5.
  const socialLimit = fmtRub(yearRules(draft.year).socialGroup);
  const applied = [
    ["Имущественный вычет", calc.applied.property],
    ["Проценты по ипотеке", calc.applied.interest],
    ["Лечение и лекарства", calc.lines.medicalOrdinary],
    ["Своё обучение", calc.lines.educationSelf],
    ["Страхование жизни", calc.lines.insurance],
    ["Спорт и фитнес", calc.lines.sport],
    ["Обучение детей", calc.applied.childEducation],
    ["Дорогостоящее лечение", calc.applied.expensiveMedical],
    ["ИИС", calc.applied.iis],
  ].filter(([, v]) => v > 0);

  return (
    <div>
      {incomeGaps && (
        <div className="doc-note doc-note--err" style={{ marginBottom: 14 }}>
          <strong>Остались реквизиты из справки о доходах</strong> — без них
          налоговая не примет декларацию. Ваш расчёт уже готов (ниже), осталось
          перенести данные со справки: сфотографируйте её на шаге «Доходы»
          (блок «Загрузите документы» — заполнит сам), скачайте справку в{" "}
          <a
            href="https://lkfl2.nalog.ru/lkfl/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => ymGoal("lk_fns", { where: "review" })}
          >
            Личном кабинете ФНС
          </a>{" "}
          или впишите вручную.
          <div className="doc-actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => goto("income")}
            >
              Дозаполнить «Доходы»
            </button>
          </div>
        </div>
      )}
      <dl className="cabinet__list wiz__summary">
        {rows.map(([label, value, step]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value || "—"}{" "}
              <button type="button" className="wiz__edit" onClick={() => goto(step)}>
                изменить
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="wiz__calc">
        <h3 className="wiz__subhead">Расчёт возврата</h3>
        {applied.map(([label, v]) => (
          <div className="wiz__calc-row" key={label}>
            <span>{label}</span>
            <span>{fmtRub(v)}</span>
          </div>
        ))}
        <div className="wiz__calc-row wiz__calc-row--total">
          <span>Налог к возврату</span>
          <span>{fmtRub(calc.refund)}</span>
        </div>
        {calc.applied.socialGroup > 0 && (
          <p className="wiz__note">
            Лечение, своё обучение, страхование и спорт учитываются вместе — в
            пределах {socialLimit} за год. Проверьте, что вычет заявлен по тому
            основанию, по которому у вас есть документы: налоговая сверяет
            строку декларации с приложенными договорами и чеками.
          </p>
        )}
        {calc.carryover.property + calc.carryover.interest > 0 && (
          <p className="wiz__note">
            Остаток вычета {fmtRub((calc.carryover.property + calc.carryover.interest) )}{" "}
            перейдёт на следующие годы — его можно будет заявить в декларации за{" "}
            {draft.year + 1} год.
          </p>
        )}
      </div>

      {/* Комбинированная декларация: доход от продажи — своя налоговая база,
          вычеты к ней не применяются. Поэтому расчёт показываем отдельным
          блоком, а внизу сводим одной строкой — человеку важен именно итог. */}
      {calc.mixed && (
        <div className="wiz__calc">
          <h3 className="wiz__subhead">Расчёт налога с продажи</h3>
          <div className="wiz__calc-row">
            <span>Доход от продажи</span>
            <span>{fmtRub(calc.sale.taxable)}</span>
          </div>
          <div className="wiz__calc-row">
            <span>Вычеты и расходы</span>
            <span>−{fmtRub(calc.sale.deduction)}</span>
          </div>
          <div className="wiz__calc-row wiz__calc-row--total">
            <span>Налог к уплате</span>
            <span>{fmtRub(calc.owed)}</span>
          </div>
          <div className="wiz__calc-row wiz__calc-row--total">
            <span>{calc.net >= 0 ? "Итого вам вернут" : "Итого доплатить"}</span>
            <span>{fmtRub(Math.abs(calc.net))}</span>
          </div>
          <p className="wiz__note">
            Зарплата и доход от продажи — разные налоговые базы, вычеты к доходу
            от продажи не применяются. В декларации обе суммы стоят рядом:
            {" "}{fmtRub(calc.refund)} к возврату и {fmtRub(calc.owed)} к уплате.
            Сводит их налоговая на едином налоговом счёте — доплатить нужно
            только разницу, до 15 июля {Number(draft.year) + 1} года.
          </p>
        </div>
      )}

      {calc.warnings.map((w) => (
        <div className="doc-note doc-note--err" key={w}>
          {w}
        </div>
      ))}
      {calc.refund <= 0 && !calc.mixed && (
        <div className="doc-note doc-note--err">
          По введённым данным возврат равен нулю. Проверьте суммы дохода,
          удержанного налога и расходов.
        </div>
      )}
    </div>
  );
}
