// Шаг «Проверка»: сводка введённого и расчёт (возврат ИЛИ налог к уплате).
// calc приходит из WizardShell — расчёт выполняется один раз на рендер.
import { useWizard } from "../WizardContext.jsx";
import { wizardDeductions, stepsFor, stepIndexIn } from "../../data/wizard.js";
import { yearRules, SALE_DEDUCTION, SALE_REALTY_OBJECTS } from "../../lib/ndfl/refs.js";
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

  // Продажа имущества: сводка и налог к уплате (Приложение 6), без возврата.
  if (calc.sale) {
    const s = calc.sale;
    const expenses = s.deductionKind === "expenses";
    const realty = s.kind === "realty";
    const objectLabel = realty
      ? SALE_REALTY_OBJECTS.find((o) => o.value === s.objectKind)?.label || "Недвижимость"
      : "Автомобиль (иное имущество)";
    const saleRows = [
      ["Отчётный год", draft.year, "types"],
      ["Что продали", objectLabel, "sale"],
      ["Цена продажи", fmtRub(s.price), "sale"],
      ...(realty
        ? [
            ["Кадастровый номер", s.cadastralNumber || "—", "sale"],
            ["Кадастровая стоимость", fmtRub(s.cadastral), "sale"],
          ]
        : []),
      [expenses ? "Расходы на покупку" : "Вычет", fmtRub(s.deduction), "sale"],
      ["Покупатель", draft.sale?.buyerName || "—", "sale"],
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
            <span>Доход от продажи</span>
            <span>{fmtRub(s.taxable)}</span>
          </div>
          <div className="wiz__calc-row">
            <span>
              {expenses
                ? "Расходы на покупку"
                : `Вычет ${fmtRub(realty ? SALE_DEDUCTION.realty : SALE_DEDUCTION.other)}`}
            </span>
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
    ["Счёт для возврата", `${draft.bank.bik} / ${draft.bank.account}`, "bank"],
  ];

  const applied = [
    ["Имущественный вычет", calc.applied.property],
    ["Проценты по ипотеке", calc.applied.interest],
    [
      `Лечение, обучение, страхование, спорт (лимит ${fmtRub(yearRules(draft.year).socialGroup)})`,
      calc.applied.socialGroup,
    ],
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
        {calc.carryover.property + calc.carryover.interest > 0 && (
          <p className="wiz__note">
            Остаток вычета {fmtRub((calc.carryover.property + calc.carryover.interest) )}{" "}
            перейдёт на следующие годы — его можно будет заявить в декларации за{" "}
            {draft.year + 1} год.
          </p>
        )}
      </div>

      {calc.warnings.map((w) => (
        <div className="doc-note doc-note--err" key={w}>
          {w}
        </div>
      ))}
      {calc.refund <= 0 && (
        <div className="doc-note doc-note--err">
          По введённым данным возврат равен нулю. Проверьте суммы дохода,
          удержанного налога и расходов.
        </div>
      )}
    </div>
  );
}
