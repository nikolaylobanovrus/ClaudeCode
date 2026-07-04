// Шаг 6: сводка введённого и расчёт возврата перед оплатой.
// calc приходит из WizardShell — расчёт выполняется один раз на рендер.
import { useWizard } from "../WizardContext.jsx";
import { wizardDeductions, stepIndex } from "../../data/wizard.js";
import { fmtRub } from "../../lib/format.js";

export default function StepReview({ calc }) {
  const { draft, dispatch } = useWizard();
  const p = draft.personal;
  const goto = (key) => dispatch({ type: "GOTO", step: stepIndex(key) });

  const rows = [
    ["Отчётный год", draft.year, "types"],
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
    ["Лечение, обучение, страхование (лимит 150 000 ₽)", calc.applied.socialGroup],
    ["Обучение детей", calc.applied.childEducation],
    ["Дорогостоящее лечение", calc.applied.expensiveMedical],
    ["ИИС", calc.applied.iis],
  ].filter(([, v]) => v > 0);

  return (
    <div>
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
