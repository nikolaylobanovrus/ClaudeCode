// Шаг 4: расходы по каждому выбранному вычету. Рендерятся только секции
// выбранных на шаге 1 ситуаций.
import { useWizard } from "../WizardContext.jsx";
import { HINTS } from "../../data/wizard.js";
import { Field, TextInput, MoneyInput, DateInput, SelectInput, Hint } from "../fields.jsx";
import {
  yearRules,
  PROPERTY_OBJECTS,
  PROPERTY_OWNERS,
  propertyIsHouse,
} from "../../lib/ndfl/refs.js";
import { fmtRub } from "../../lib/format.js";

export default function StepDetails({ errors }) {
  const { draft, dispatch } = useWizard();
  const has = (t) => draft.types.includes(t);
  const setP = (patch) => dispatch({ type: "PATCH", section: "property", patch });

  return (
    <div>
      {(has("kvartira") || has("ipoteka")) && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">🏠 Жильё</h3>
          <div className="wiz__row">
            <Field label="Что купили" hint={HINTS.objectKind}>
              <SelectInput
                value={draft.property.objectKind || "flat"}
                options={PROPERTY_OBJECTS}
                onChange={(v) => setP({ objectKind: v })}
              />
            </Field>
            <Field label="Кто собственник по документам" hint={HINTS.owner}>
              <SelectInput
                value={draft.property.owner || "self"}
                options={PROPERTY_OWNERS}
                onChange={(v) => setP({ owner: v })}
              />
            </Field>
          </div>
          {propertyIsHouse(draft.property.objectKind) && (
            <div className="form__field">
              <label>
                Как приобрели дом
                <Hint text={HINTS.buildMethod} />
              </label>
              <div className="calc__types">
                {[
                  { v: "bought", t: "Купили готовый" },
                  { v: "new", t: "Построили (новое строительство)" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    className={
                      "calc__chip" +
                      ((draft.property.buildMethod || "bought") === o.v ? " is-active" : "")
                    }
                    onClick={() => setP({ buildMethod: o.v })}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="wiz__checkline">
            <input
              type="checkbox"
              checked={Boolean(draft.property.pensioner)}
              onChange={(e) => setP({ pensioner: e.target.checked })}
            />
            <span>
              Я пенсионер и заявляю вычет с переносом на прошлые годы
              <Hint text={HINTS.pensioner} />
            </span>
          </label>
          <Field label="Адрес объекта" error={errors["property.address"]}>
            <TextInput value={draft.property.address} error={errors["property.address"]}
              placeholder="г. Москва, ул. Ленина, д. 1, кв. 2"
              onChange={(v) => setP({ address: v })} />
          </Field>
          <div className="wiz__row">
            <Field label="Кадастровый номер (если знаете)" hint={HINTS.cadastral}>
              <TextInput value={draft.property.cadastral} placeholder="77:01:0001001:1234"
                onChange={(v) => setP({ cadastral: v })} />
            </Field>
            <Field label="Дата регистрации права" error={errors["property.dateReg"]}>
              <DateInput value={draft.property.dateReg} error={errors["property.dateReg"]}
                onChange={(v) => setP({ dateReg: v })} />
            </Field>
            <Field label="Дата акта приёма-передачи (для ДДУ)">
              <DateInput value={draft.property.dateAct}
                onChange={(v) => setP({ dateAct: v })} />
            </Field>
          </div>
          {has("kvartira") && (
            <div className="wiz__row">
              <Field label="Стоимость жилья, ₽" hint={HINTS.propertyCost}
                error={errors["property.cost"]}>
                <MoneyInput value={draft.property.cost} error={errors["property.cost"]}
                  onChange={(v) => setP({ cost: v })} />
              </Field>
              <Field label="Вычет, использованный ранее, ₽" hint={HINTS.priorDeduction}>
                <MoneyInput value={draft.property.priorDeduction}
                  onChange={(v) => setP({ priorDeduction: v })} />
              </Field>
            </div>
          )}
          {has("ipoteka") && (
            <div className="wiz__row">
              <Field label="Проценты, уплаченные банку, ₽" hint={HINTS.interest}
                error={errors["property.interestPaid"]}>
                <MoneyInput value={draft.property.interestPaid}
                  error={errors["property.interestPaid"]}
                  onChange={(v) => setP({ interestPaid: v })} />
              </Field>
              <Field label="Вычет по процентам, использованный ранее, ₽">
                <MoneyInput value={draft.property.priorInterest}
                  onChange={(v) => setP({ priorInterest: v })} />
              </Field>
            </div>
          )}
        </section>
      )}

      {has("lechenie") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">⚕️ Лечение</h3>
          <div className="wiz__row">
            <Field label="Обычное лечение и лекарства, ₽" hint={HINTS.medicalOrdinary}
              error={errors["medical.ordinary"]}>
              <MoneyInput value={draft.medical.ordinary} error={errors["medical.ordinary"]}
                onChange={(v) =>
                  dispatch({ type: "PATCH", section: "medical", patch: { ordinary: v } })
                } />
            </Field>
            <Field label="Дорогостоящее лечение (код 2), ₽" hint={HINTS.medicalExpensive}>
              <MoneyInput value={draft.medical.expensive}
                onChange={(v) =>
                  dispatch({ type: "PATCH", section: "medical", patch: { expensive: v } })
                } />
            </Field>
          </div>
        </section>
      )}

      {has("obuchenie") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">🎓 Обучение</h3>
          <Field label="Своё обучение, ₽" hint={HINTS.educationSelf}
            error={errors["education.self"]}>
            <MoneyInput value={draft.education.self} error={errors["education.self"]}
              onChange={(v) =>
                dispatch({ type: "PATCH", section: "education", patch: { self: v } })
              } />
          </Field>
          <div className="form__field">
            <label>Обучение детей (до {fmtRub(yearRules(draft.year).childEducation)} на ребёнка за {draft.year} год)</label>
            {draft.education.children.map((c, i) => (
              <div className="wiz__child" key={i}>
                <MoneyInput value={c.amount} aria-label={`Обучение ребёнка ${i + 1}, ₽`}
                  onChange={(v) => dispatch({ type: "PATCH_CHILD", index: i, amount: v })} />
                <button type="button" className="wiz__remove"
                  onClick={() => dispatch({ type: "REMOVE_CHILD", index: i })}>
                  Удалить
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--ghost"
              onClick={() => dispatch({ type: "ADD_CHILD" })}>
              + Добавить ребёнка
            </button>
          </div>
        </section>
      )}

      {has("iis") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">📈 ИИС</h3>
          <Field label={`Взносы на ИИС за ${draft.year} год, ₽`} hint={HINTS.iis}
            error={errors["iis.contribution"]}>
            <MoneyInput value={draft.iis.contribution} error={errors["iis.contribution"]}
              onChange={(v) =>
                dispatch({ type: "PATCH", section: "iis", patch: { contribution: v } })
              } />
          </Field>
        </section>
      )}

      {has("strahovanie") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">🛡️ Страхование жизни</h3>
          <Field label="Взносы за год, ₽" hint={HINTS.insurance}
            error={errors["insurance.amount"]}>
            <MoneyInput value={draft.insurance.amount} error={errors["insurance.amount"]}
              onChange={(v) =>
                dispatch({ type: "PATCH", section: "insurance", patch: { amount: v } })
              } />
          </Field>
        </section>
      )}
    </div>
  );
}
