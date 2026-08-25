// Шаг «Продажа»: доход от продажи имущества и способ уменьшить налог.
// Объектов может быть несколько — за год человек мог продать и машину, и
// квартиру, и всё это идёт ОДНОЙ декларацией (Приложение 6).
//
// Важно про вычет: 250 000 ₽ и 1 000 000 ₽ — лимиты ГОДОВЫЕ и общие на все
// объекты своего класса, а не на каждую продажу. Считает это calc.js, здесь
// показываем результат по объектам и итог.
// calc приходит из WizardShell (в нём уже посчитан owed по draft.sales).
import { useWizard } from "../WizardContext.jsx";
import { HINTS, SALE_SLUGS } from "../../data/wizard.js";
import {
  SALE_DEDUCTION,
  SALE_REALTY_OBJECTS,
  SALE_REALTY_BASES,
} from "../../lib/ndfl/refs.js";
import { Field, TextInput, MoneyInput, DateInput, SelectInput } from "../fields.jsx";
import { fmtRub } from "../../lib/format.js";

// Один список видов вместо двух контролов: человек не обязан знать, что
// машина в декларации называется «иным имуществом».
const OBJECT_OPTIONS = [
  { value: "auto", label: "Автомобиль или иное имущество" },
  ...SALE_REALTY_OBJECTS,
];

const kindOf = (value) => (value === "auto" ? "auto" : "realty");

export default function StepSale({ errors = {}, calc }) {
  const { draft, dispatch } = useWizard();
  const items = draft.sales || [];
  const sale = calc?.sale;

  // Ситуации на первом шаге держим в согласии с реально выбранными видами:
  // добавили квартиру к машине — в декларации появляются оба вида имущества.
  const syncTypes = (list) => {
    const kinds = new Set(list.map((s) => kindOf(s.objectKind || (s.kind === "realty" ? "flat" : "auto"))));
    const rest = (draft.types || []).filter((t) => !SALE_SLUGS.includes(t));
    const next = [...rest];
    if (kinds.has("auto")) next.push("prodazha_auto");
    if (kinds.has("realty")) next.push("prodazha_realty");
    dispatch({ type: "SET", key: "types", value: next });
  };

  const patch = (i, p) => {
    dispatch({ type: "PATCH_SALE", index: i, patch: p });
    if ("objectKind" in p || "kind" in p)
      syncTypes(items.map((s, j) => (j === i ? { ...s, ...p } : s)));
  };

  const addObject = () => dispatch({ type: "ADD_SALE" });

  const removeObject = (i) => {
    dispatch({ type: "REMOVE_SALE", index: i });
    syncTypes(items.filter((_, j) => j !== i));
  };

  return (
    <div>
      <p className="wiz__note" style={{ marginTop: 0 }}>
        Продали имущество, которым владели меньше минимального срока (машина —
        3 года, недвижимость — 5 лет, в льготных случаях 3)? Нужно подать
        3-НДФЛ и, если была прибыль, заплатить налог. Мы посчитаем его и
        законно уменьшим. Продали за год несколько вещей — добавьте их все
        сюда, декларация всё равно одна.
      </p>

      {items.map((s, i) => {
        const err = (f) => errors[`sale.${i}.${f}`];
        const value = s.objectKind || (s.kind === "realty" ? "flat" : "auto");
        const realty = kindOf(value) === "realty";
        const expenses = s.deductionKind === "expenses";
        const calcItem = sale?.items?.[i];
        const stdDeduction = realty ? SALE_DEDUCTION.realty : SALE_DEDUCTION.other;

        return (
          <fieldset className="wiz__employer" key={i}>
            <legend>
              Объект {i + 1}
              {items.length > 1 && (
                <button type="button" className="wiz__remove" onClick={() => removeObject(i)}>
                  Удалить
                </button>
              )}
            </legend>

            <Field label="Что вы продали" hint={HINTS.saleObjectKind}>
              <SelectInput
                value={value}
                onChange={(v) =>
                  patch(i, { objectKind: v === "auto" ? "" : v, kind: kindOf(v) })
                }
                options={OBJECT_OPTIONS}
              />
            </Field>

            <Field
              label="Цена продажи, ₽"
              hint={realty ? HINTS.salePriceRealty : HINTS.salePrice}
              error={err("price")}
            >
              <MoneyInput value={s.price} onChange={(v) => patch(i, { price: v })} error={err("price")} />
            </Field>

            {realty && (
              <>
                <Field label="Кадастровый номер" hint={HINTS.saleCadastralNumber} error={err("cadastralNumber")}>
                  <TextInput
                    value={s.cadastralNumber}
                    onChange={(v) => patch(i, { cadastralNumber: v })}
                    error={err("cadastralNumber")}
                    placeholder="00:00:0000000:000"
                  />
                </Field>

                <Field label="Кадастровая стоимость, ₽" hint={HINTS.saleCadastralValue} error={err("cadastralValue")}>
                  <MoneyInput
                    value={s.cadastralValue}
                    onChange={(v) => patch(i, { cadastralValue: v })}
                    error={err("cadastralValue")}
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

            <Field label="Дата продажи" hint={HINTS.saleDate} error={err("saleDate")}>
              <DateInput value={s.saleDate} onChange={(v) => patch(i, { saleDate: v })} error={err("saleDate")} />
            </Field>

            {realty && (
              <>
                <Field label="Дата приобретения" hint={HINTS.saleAcquireDate} error={err("acquireDate")}>
                  <DateInput
                    value={s.acquireDate}
                    onChange={(v) => patch(i, { acquireDate: v })}
                    error={err("acquireDate")}
                  />
                </Field>

                <Field label="Как получили объект" hint={HINTS.saleRealtyBasis}>
                  <SelectInput
                    value={s.realtyBasis || "purchase"}
                    onChange={(v) => patch(i, { realtyBasis: v })}
                    options={SALE_REALTY_BASES}
                  />
                </Field>
              </>
            )}

            {/* Освобождение по сроку владения — показываем сразу, денег не берём. */}
            {calcItem?.holdingExempt && (
              <div className="doc-note doc-note--ok" style={{ marginBottom: 14 }}>
                Вы владели этим имуществом {calcItem.held}{" "}
                {calcItem.held === 1 ? "год" : "лет"} — это не меньше минимального
                срока ({calcItem.minHolding} {calcItem.minHolding === 3 ? "года" : "лет"}).
                Доход от продажи налогом не облагается, и декларацию 3-НДФЛ по
                этому объекту подавать не нужно.
              </div>
            )}

            <Field label="Как уменьшить налог" hint={realty ? HINTS.saleDeductionRealty : HINTS.saleDeduction}>
              <div className="wiz__types" role="radiogroup" aria-label="Способ уменьшить налог">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!expenses}
                  className={"wiz__type" + (!expenses ? " is-active" : "")}
                  onClick={() => patch(i, { deductionKind: "standard" })}
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
                  onClick={() => patch(i, { deductionKind: "expenses" })}
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
              <Field label="Расходы на покупку, ₽" hint={HINTS.saleExpenses} error={err("expenses")}>
                <MoneyInput value={s.expenses} onChange={(v) => patch(i, { expenses: v })} error={err("expenses")} />
              </Field>
            )}

            <Field label="Покупатель (ФИО)" hint={HINTS.saleBuyer} error={err("buyerName")}>
              <TextInput
                value={s.buyerName}
                onChange={(v) => patch(i, { buyerName: v })}
                error={err("buyerName")}
                placeholder="Иванов Иван Иванович"
              />
            </Field>

            <Field label="ИНН покупателя (необязательно)" hint={HINTS.saleBuyerInn} error={err("buyerInn")}>
              <MoneyInput value={s.buyerInn} onChange={(v) => patch(i, { buyerInn: v })} error={err("buyerInn")} />
            </Field>

            {calcItem && calcItem.price > 0 && (
              <div className="wiz__calc">
                <div className="wiz__calc-row">
                  <span>Доход от продажи</span>
                  <span>{fmtRub(calcItem.taxable)}</span>
                </div>
                {realty && calcItem.byCadastral && (
                  <p className="wiz__note" style={{ margin: "0 0 6px" }}>
                    Цена договора ({fmtRub(calcItem.price)}) меньше 70% кадастровой
                    стоимости — по закону налог считается с {fmtRub(calcItem.taxable)}{" "}
                    (кадастр × 0,7).
                  </p>
                )}
                <div className="wiz__calc-row">
                  <span>{expenses ? "Расходы на покупку" : "Вычет"}</span>
                  <span>−{fmtRub(calcItem.deduction)}</span>
                </div>
                {!expenses && calcItem.deduction < Math.min(stdDeduction, calcItem.taxable) && (
                  <p className="wiz__note" style={{ margin: "0 0 6px" }}>
                    Вычет {fmtRub(stdDeduction)} — общий на все проданные за год
                    объекты этого вида, а не на каждый. Здесь от него осталось{" "}
                    {fmtRub(calcItem.deduction)}.
                  </p>
                )}
              </div>
            )}
          </fieldset>
        );
      })}

      <button type="button" className="btn btn--ghost" onClick={addObject}>
        + Продал ещё один объект
      </button>

      {sale && sale.price > 0 && (
        <div className="wiz__calc" style={{ marginTop: 14 }}>
          <div className="wiz__calc-row">
            <span>Доход от всех продаж</span>
            <span>{fmtRub(sale.taxable)}</span>
          </div>
          <div className="wiz__calc-row">
            <span>Вычеты и расходы</span>
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
