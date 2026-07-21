// Шаг «Продажа»: доход от продажи автомобиля и способ уменьшить налог.
// Декларация с налогом К УПЛАТЕ (Приложение 6, налог 13% с прибыли).
// calc приходит из WizardShell (в нём уже посчитан owed по draft.sale).
import { useWizard } from "../WizardContext.jsx";
import { HINTS } from "../../data/wizard.js";
import { SALE_DEDUCTION } from "../../lib/ndfl/refs.js";
import { Field, TextInput, MoneyInput, DateInput, Hint } from "../fields.jsx";
import { fmtRub } from "../../lib/format.js";

export default function StepSale({ errors = {}, calc }) {
  const { draft, dispatch } = useWizard();
  const s = draft.sale || {};
  const set = (patch) => dispatch({ type: "PATCH", section: "sale", patch });
  const expenses = s.deductionKind === "expenses";
  const sale = calc?.sale;

  return (
    <div>
      <p className="wiz__note" style={{ marginTop: 0 }}>
        Продали автомобиль, которым владели меньше 3 лет? Нужно подать 3-НДФЛ и,
        если была прибыль, заплатить налог. Мы посчитаем его и законно уменьшим.
      </p>

      <Field label="Цена продажи, ₽" hint={HINTS.salePrice} error={errors["sale.price"]}>
        <MoneyInput
          value={s.price}
          onChange={(v) => set({ price: v })}
          error={errors["sale.price"]}
        />
      </Field>

      <Field label="Дата продажи" hint={HINTS.saleDate} error={errors["sale.saleDate"]}>
        <DateInput
          value={s.saleDate}
          onChange={(v) => set({ saleDate: v })}
          error={errors["sale.saleDate"]}
        />
      </Field>

      <Field label="Как уменьшить налог" hint={HINTS.saleDeduction}>
        <div className="wiz__types" role="radiogroup" aria-label="Способ уменьшить налог">
          <button
            type="button"
            role="radio"
            aria-checked={!expenses}
            className={"wiz__type" + (!expenses ? " is-active" : "")}
            onClick={() => set({ deductionKind: "standard" })}
          >
            <span className="wiz__type-icon" aria-hidden="true">🧾</span>
            <span>
              <span className="wiz__type-title">
                Вычет {fmtRub(SALE_DEDUCTION.other)}
              </span>
              <span className="wiz__type-limit">без документов, подойдёт всем</span>
            </span>
            <span className="wiz__type-check" aria-hidden="true">{!expenses ? "✓" : ""}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={expenses}
            className={"wiz__type" + (expenses ? " is-active" : "")}
            onClick={() => set({ deductionKind: "expenses" })}
          >
            <span className="wiz__type-icon" aria-hidden="true">📄</span>
            <span>
              <span className="wiz__type-title">Мои расходы на покупку</span>
              <span className="wiz__type-limit">нужен договор покупки</span>
            </span>
            <span className="wiz__type-check" aria-hidden="true">{expenses ? "✓" : ""}</span>
          </button>
        </div>
      </Field>

      {expenses && (
        <Field
          label="Расходы на покупку, ₽"
          hint={HINTS.saleExpenses}
          error={errors["sale.expenses"]}
        >
          <MoneyInput
            value={s.expenses}
            onChange={(v) => set({ expenses: v })}
            error={errors["sale.expenses"]}
          />
        </Field>
      )}

      <Field label="Покупатель (ФИО)" hint={HINTS.saleBuyer} error={errors["sale.buyerName"]}>
        <TextInput
          value={s.buyerName}
          onChange={(v) => set({ buyerName: v })}
          error={errors["sale.buyerName"]}
          placeholder="Иванов Иван Иванович"
        />
      </Field>

      <Field label="ИНН покупателя (необязательно)" hint={HINTS.saleBuyerInn} error={errors["sale.buyerInn"]}>
        <MoneyInput
          value={s.buyerInn}
          onChange={(v) => set({ buyerInn: v })}
          error={errors["sale.buyerInn"]}
        />
      </Field>

      {sale && sale.price > 0 && (
        <div className="wiz__calc">
          <div className="wiz__calc-row">
            <span>Доход от продажи</span>
            <span>{fmtRub(sale.taxable)}</span>
          </div>
          <div className="wiz__calc-row">
            <span>{expenses ? "Расходы на покупку" : `Вычет ${fmtRub(SALE_DEDUCTION.other)}`}</span>
            <span>−{fmtRub(sale.deduction)}</span>
          </div>
          <div className="wiz__calc-row wiz__calc-row--total">
            <span>Налог к уплате (13%)</span>
            <span>{fmtRub(sale.tax)}</span>
          </div>
          {sale.tax === 0 && (
            <p className="wiz__note">
              Налог к уплате — 0 ₽, но декларацию подать всё равно нужно: продажу
              имущества со сроком владения меньше 3 лет обязательно декларировать.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
