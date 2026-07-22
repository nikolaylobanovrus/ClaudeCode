// Шаг «Продажа»: доход от продажи имущества и способ уменьшить налог.
// Декларация с налогом К УПЛАТЕ (Приложение 6, налог 13% с прибыли).
// Две ветки: автомобиль (иное имущество, вычет 250 000 ₽) и недвижимость
// (жильё/земля, вычет 1 000 000 ₽, правило «кадастр × 0,7», срок владения 5 лет).
// calc приходит из WizardShell (в нём уже посчитан owed по draft.sale).
import { useWizard } from "../WizardContext.jsx";
import { HINTS, saleKindOf } from "../../data/wizard.js";
import {
  SALE_DEDUCTION,
  SALE_REALTY_OBJECTS,
  SALE_REALTY_BASES,
} from "../../lib/ndfl/refs.js";
import { Field, TextInput, MoneyInput, DateInput, SelectInput, Hint } from "../fields.jsx";
import { fmtRub } from "../../lib/format.js";

export default function StepSale({ errors = {}, calc }) {
  const { draft, dispatch } = useWizard();
  const s = draft.sale || {};
  const set = (patch) => dispatch({ type: "PATCH", section: "sale", patch });
  const realty = saleKindOf(draft) === "realty";
  const expenses = s.deductionKind === "expenses";
  const sale = calc?.sale;
  const stdDeduction = realty ? SALE_DEDUCTION.realty : SALE_DEDUCTION.other;

  return (
    <div>
      <p className="wiz__note" style={{ marginTop: 0 }}>
        {realty
          ? "Продали недвижимость, которой владели меньше минимального срока (5 лет, в льготных случаях 3 года)? Нужно подать 3-НДФЛ и, если была прибыль, заплатить налог. Мы посчитаем его и законно уменьшим."
          : "Продали автомобиль, которым владели меньше 3 лет? Нужно подать 3-НДФЛ и, если была прибыль, заплатить налог. Мы посчитаем его и законно уменьшим."}
      </p>

      {realty && (
        <Field label="Что вы продали" hint={HINTS.saleObjectKind}>
          <SelectInput
            value={s.objectKind || "flat"}
            onChange={(v) => set({ objectKind: v })}
            options={SALE_REALTY_OBJECTS}
          />
        </Field>
      )}

      <Field
        label="Цена продажи, ₽"
        hint={realty ? HINTS.salePriceRealty : HINTS.salePrice}
        error={errors["sale.price"]}
      >
        <MoneyInput value={s.price} onChange={(v) => set({ price: v })} error={errors["sale.price"]} />
      </Field>

      {realty && (
        <>
          <Field
            label="Кадастровый номер"
            hint={HINTS.saleCadastralNumber}
            error={errors["sale.cadastralNumber"]}
          >
            <TextInput
              value={s.cadastralNumber}
              onChange={(v) => set({ cadastralNumber: v })}
              error={errors["sale.cadastralNumber"]}
              placeholder="00:00:0000000:000"
            />
          </Field>

          <Field
            label="Кадастровая стоимость, ₽"
            hint={HINTS.saleCadastralValue}
            error={errors["sale.cadastralValue"]}
          >
            <MoneyInput
              value={s.cadastralValue}
              onChange={(v) => set({ cadastralValue: v })}
              error={errors["sale.cadastralValue"]}
            />
            <p className="wiz__note" style={{ margin: "6px 0 0" }}>
              Не знаете стоимость?{" "}
              <a
                href="https://lk.rosreestr.ru/eservices/real-estate-objects-online"
                target="_blank"
                rel="noopener noreferrer"
              >
                Узнать бесплатно на сайте Росреестра
              </a>{" "}
              по кадастровому номеру.
            </p>
          </Field>
        </>
      )}

      <Field label="Дата продажи" hint={HINTS.saleDate} error={errors["sale.saleDate"]}>
        <DateInput value={s.saleDate} onChange={(v) => set({ saleDate: v })} error={errors["sale.saleDate"]} />
      </Field>

      {realty && (
        <>
          <Field
            label="Дата приобретения"
            hint={HINTS.saleAcquireDate}
            error={errors["sale.acquireDate"]}
          >
            <DateInput
              value={s.acquireDate}
              onChange={(v) => set({ acquireDate: v })}
              error={errors["sale.acquireDate"]}
            />
          </Field>

          <Field label="Как получили объект" hint={HINTS.saleRealtyBasis}>
            <SelectInput
              value={s.realtyBasis || "purchase"}
              onChange={(v) => set({ realtyBasis: v })}
              options={SALE_REALTY_BASES}
            />
          </Field>
        </>
      )}

      {/* Освобождение по сроку владения — показываем сразу, деньги не берём. */}
      {sale && sale.holdingExempt && (
        <div className="doc-note doc-note--ok" style={{ marginBottom: 14 }}>
          Вы владели этим имуществом {sale.held} {sale.held === 1 ? "год" : "лет"} — это не
          меньше минимального срока ({sale.minHolding}{" "}
          {sale.minHolding === 3 ? "года" : "лет"}). Доход от продажи налогом не
          облагается, и декларацию 3-НДФЛ подавать не нужно.
        </div>
      )}

      <Field label="Как уменьшить налог" hint={realty ? HINTS.saleDeductionRealty : HINTS.saleDeduction}>
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
              <span className="wiz__type-title">Вычет {fmtRub(stdDeduction)}</span>
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
        <Field label="Расходы на покупку, ₽" hint={HINTS.saleExpenses} error={errors["sale.expenses"]}>
          <MoneyInput value={s.expenses} onChange={(v) => set({ expenses: v })} error={errors["sale.expenses"]} />
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
        <MoneyInput value={s.buyerInn} onChange={(v) => set({ buyerInn: v })} error={errors["sale.buyerInn"]} />
      </Field>

      {sale && sale.price > 0 && (
        <div className="wiz__calc">
          <div className="wiz__calc-row">
            <span>Доход от продажи</span>
            <span>{fmtRub(sale.taxable)}</span>
          </div>
          {realty && sale.byCadastral && (
            <p className="wiz__note" style={{ margin: "0 0 6px" }}>
              Цена договора ({fmtRub(sale.price)}) меньше 70% кадастровой стоимости —
              по закону налог считается с {fmtRub(sale.taxable)} (кадастр × 0,7).
            </p>
          )}
          <div className="wiz__calc-row">
            <span>{expenses ? "Расходы на покупку" : `Вычет ${fmtRub(sale.deduction)}`}</span>
            <span>−{fmtRub(sale.deduction)}</span>
          </div>
          <div className="wiz__calc-row wiz__calc-row--total">
            <span>Налог к уплате (13%)</span>
            <span>{fmtRub(sale.tax)}</span>
          </div>
          {sale.tax === 0 && !sale.holdingExempt && (
            <p className="wiz__note">
              Налог к уплате — 0 ₽, но декларацию подать всё равно нужно: продажу
              имущества со сроком владения меньше минимального обязательно
              декларировать.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
