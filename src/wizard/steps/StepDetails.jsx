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

// Реквизиты договора для листа «Расчёт к Приложению 5»: один и тот же набор
// у страховой организации (раздел 1) и у брокера по ИИС (раздел 2). ИНН и КПП
// обязательны по схеме ФНС — в декларации без них лист не примут.
function Contract({ sec, keys, who, v, errors, dispatch }) {
  const set = (patch) => dispatch({ type: "PATCH", section: sec, patch });
  const err = (k) => errors[`${sec}.${k}`];
  return (
    <>
      <Field label={`Название ${who}`} error={err(keys.name)}>
        <TextInput value={v[keys.name]} error={err(keys.name)}
          onChange={(x) => set({ [keys.name]: x })} />
      </Field>
      <div className="form__row">
        <Field label="ИНН" error={err(keys.inn)}>
          <TextInput value={v[keys.inn]} error={err(keys.inn)} inputMode="numeric"
            onChange={(x) => set({ [keys.inn]: x.replace(/\D/g, "").slice(0, 12) })} />
        </Field>
        <Field label="КПП" error={err(keys.kpp)}>
          <TextInput value={v[keys.kpp]} error={err(keys.kpp)} inputMode="numeric"
            onChange={(x) => set({ [keys.kpp]: x.replace(/\D/g, "").slice(0, 9) })} />
        </Field>
      </div>
      <div className="form__row">
        <Field label="Дата договора" error={err("contractDate")}>
          <DateInput value={v.contractDate} error={err("contractDate")}
            onChange={(x) => set({ contractDate: x })} />
        </Field>
        <Field label="Номер договора" error={err("contractNumber")}>
          <TextInput value={v.contractNumber} error={err("contractNumber")}
            onChange={(x) => set({ contractNumber: x.slice(0, 40) })} />
        </Field>
      </div>
    </>
  );
}

export default function StepDetails({ errors, calc }) {
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

      {has("deti") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">👶 Вычет на детей</h3>
          <p className="wiz__note">
            С 2025 года работодатель обязан давать этот вычет сам, без заявления.
            Если он дал его полностью — по декларации возвращать нечего, но
            указать данные всё равно нужно: без них налоговая посчитает базу иначе.
          </p>
          {(draft.standard.children || []).map((c, i) => (
            <div className="wiz__row" key={i}>
              <Field label={`Ребёнок ${i + 1} — по счёту в семье`}>
                <SelectInput value={c.order}
                  onChange={(v) => dispatch({ type: "PATCH_STD_CHILD", index: i, patch: { order: v } })}
                  options={[
                    { value: "1", label: "Первый" },
                    { value: "2", label: "Второй" },
                    { value: "3", label: "Третий или последующий" },
                  ]} />
              </Field>
              <Field label="Инвалидность">
                <SelectInput value={c.disabled ? "1" : "0"}
                  onChange={(v) =>
                    dispatch({ type: "PATCH_STD_CHILD", index: i, patch: { disabled: v === "1" } })}
                  options={[{ value: "0", label: "Нет" }, { value: "1", label: "Ребёнок-инвалид" }]} />
              </Field>
              <button type="button" className="btn btn--ghost"
                onClick={() => dispatch({ type: "DROP_STD_CHILD", index: i })}>Убрать</button>
            </div>
          ))}
          <button type="button" className="btn btn--ghost"
            onClick={() => dispatch({ type: "ADD_STD_CHILD" })}>+ Добавить ребёнка</button>
          <div className="wiz__row">
            <Field label="Вычет уже предоставлен работодателем, ₽" hint={HINTS.stdProvided}
              error={errors["standard.providedByAgent"]}>
              <MoneyInput value={draft.standard.providedByAgent}
                error={errors["standard.providedByAgent"]}
                onChange={(v) => dispatch({ type: "PATCH", section: "standard", patch: { providedByAgent: v } })} />
            </Field>
            <Field label="Месяцев, за которые положен вычет" hint={HINTS.stdMonths}>
              <TextInput value={draft.standard.months} inputMode="numeric"
                placeholder={String(calc.standard?.months ?? "")}
                onChange={(v) => dispatch({ type: "PATCH", section: "standard", patch: { months: v.replace(/\D/g, "").slice(0, 2) } })} />
            </Field>
          </div>
          <label className="wiz__checkline">
            <input type="checkbox" checked={Boolean(draft.standard.singleParent)}
              onChange={(e) => dispatch({ type: "PATCH", section: "standard", patch: { singleParent: e.target.checked } })} />
            <span>Я единственный родитель — вычет в двойном размере</span>
          </label>
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
          {/* Реквизиты договора: по ним заполняется раздел 2 листа «Расчёт к
              Приложению 5». Без этого листа строка 210 остаётся без расчёта. */}
          <p className="wiz__note">Данные из договора с брокером — они нужны в декларации.</p>
          <Contract sec="iis" errors={errors} dispatch={dispatch} v={draft.iis}
            who="брокера или управляющей компании"
            keys={{ name: "brokerName", inn: "brokerInn", kpp: "brokerKpp" }} />
          <Field label="Дата открытия счёта" error={errors["iis.openDate"]}>
            <DateInput value={draft.iis.openDate} error={errors["iis.openDate"]}
              onChange={(v) => dispatch({ type: "PATCH", section: "iis", patch: { openDate: v } })} />
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
          {/* Реквизиты договора: по ним заполняется раздел 1 листа «Расчёт к
              Приложению 5», из которого берётся строка 160 Приложения 5. */}
          <p className="wiz__note">Данные из договора страхования — они нужны в декларации.</p>
          <Contract sec="insurance" errors={errors} dispatch={dispatch} v={draft.insurance}
            who="страховой организации"
            keys={{ name: "insurerName", inn: "insurerInn", kpp: "insurerKpp" }} />
        </section>
      )}

      {(has("lechenie") || has("obuchenie") || has("strahovanie") || has("sport")) && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">🏢 Вычет через работодателя</h3>
          <p className="wiz__note">
            Заполняйте, только если часть вычета за лечение или обучение вам уже
            вернули в течение года — через работодателя по уведомлению из налоговой
            или упрощённым порядком. Если ничего такого не было, оставьте пустым.
          </p>
          <div className="wiz__row">
            <Field label="Вернул работодатель за год, ₽" hint={HINTS.socialProvided}>
              <MoneyInput value={draft.socialProvided.byAgent}
                onChange={(v) => dispatch({ type: "PATCH", section: "socialProvided", patch: { byAgent: v } })} />
            </Field>
            <Field label="Получено в упрощённом порядке, ₽">
              <MoneyInput value={draft.socialProvided.simplified}
                onChange={(v) => dispatch({ type: "PATCH", section: "socialProvided", patch: { simplified: v } })} />
            </Field>
          </div>
        </section>
      )}

      {has("sport") && (
        <section className="wiz__block">
          <h3 className="wiz__subhead">🏋️ Спорт и фитнес</h3>
          <Field label={`Расходы на спорт за ${draft.year} год, ₽`} hint={HINTS.sport}
            error={errors["sport.amount"]}>
            <MoneyInput value={draft.sport.amount} error={errors["sport.amount"]}
              onChange={(v) =>
                dispatch({ type: "PATCH", section: "sport", patch: { amount: v } })
              } />
          </Field>
        </section>
      )}
    </div>
  );
}
