// Шаг 3: доходы по справкам о доходах (бывшая 2-НДФЛ) — Приложение 1 декларации.
// Работодателей может быть несколько.
import { useWizard } from "../WizardContext.jsx";
import { HINTS } from "../../data/wizard.js";
import { Field, TextInput, MoneyInput, fmtRub } from "../fields.jsx";
import { ymGoal } from "../../lib/metrika.js";

export default function StepIncome({ errors }) {
  const { draft, dispatch } = useWizard();

  const totalIncome = draft.incomes.reduce((s, i) => s + (Number(i.income) || 0), 0);
  const totalWithheld = draft.incomes.reduce((s, i) => s + (Number(i.withheld) || 0), 0);

  return (
    <div>
      <p className="wiz__note">
        Данные — из справки о доходах за {draft.year} год (бывшая 2-НДФЛ).
      </p>
      {/* Три пути вместо «стены справки»: главный обрыв воронки был здесь —
          84 % уходили, упёршись в реквизиты, которых нет под рукой. */}
      <div className="doc-note doc-note--ok" style={{ marginBottom: 14 }}>
        <strong>Нет справки под рукой?</strong> Это обычное дело — выбирайте
        любой путь:
        <ol style={{ margin: "8px 0 4px", paddingLeft: 20 }}>
          <li>
            📷 <strong>Сфотографируйте справку</strong> — блок «Загрузите
            документы» выше заполнит поля за вас;
          </li>
          <li>
            🔗 скачайте справку за минуту в{" "}
            <a
              href="https://lkfl2.nalog.ru/lkfl/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => ymGoal("lk_fns", { where: "income" })}
            >
              Личном кабинете ФНС
            </a>{" "}
            (Доходы → Справки о доходах, вход через Госуслуги);
          </li>
          <li>
            ⏭️ или просто <strong>нажмите «Далее»</strong> — продолжите с
            расходов, а реквизиты внесёте перед проверкой. Черновик сохранится.
          </li>
        </ol>
      </div>
      {errors.incomes && <div className="form__error">{errors.incomes}</div>}

      {draft.incomes.map((inc, i) => {
        const err = (f) => errors[`income.${i}.${f}`];
        const set = (patch) => dispatch({ type: "PATCH_INCOME", index: i, patch });
        return (
          <fieldset className="wiz__employer" key={i}>
            <legend>
              Работодатель {i + 1}
              {draft.incomes.length > 1 && (
                <button
                  type="button"
                  className="wiz__remove"
                  onClick={() => dispatch({ type: "REMOVE_INCOME", index: i })}
                >
                  Удалить
                </button>
              )}
            </legend>
            <Field label="Название организации" error={err("name")}>
              <TextInput value={inc.name} error={err("name")} placeholder={'ООО «Ромашка»'}
                onChange={(v) => set({ name: v })} />
            </Field>
            <div className="wiz__row">
              <Field label="ИНН работодателя" hint={HINTS.incomeInn} error={err("inn")}>
                <TextInput value={inc.inn} error={err("inn")} inputMode="numeric" maxLength={12}
                  onChange={(v) => set({ inn: v.replace(/\D/g, "") })} />
              </Field>
              <Field label="КПП (у ИП нет)" error={err("kpp")}>
                <TextInput value={inc.kpp} error={err("kpp")} inputMode="numeric" maxLength={9}
                  onChange={(v) => set({ kpp: v.replace(/\D/g, "") })} />
              </Field>
              <Field label="ОКТМО работодателя" error={err("oktmo")}>
                <TextInput value={inc.oktmo} error={err("oktmo")} inputMode="numeric" maxLength={11}
                  onChange={(v) => set({ oktmo: v.replace(/\D/g, "") })} />
              </Field>
            </div>
            <div className="wiz__row">
              <Field label="Общая сумма дохода, ₽" hint={HINTS.income} error={err("income")}>
                <MoneyInput value={inc.income} error={err("income")}
                  onChange={(v) => set({ income: v })} />
              </Field>
              <Field label="Налог удержанный, ₽" hint={HINTS.withheld} error={err("withheld")}>
                <MoneyInput value={inc.withheld} error={err("withheld")}
                  onChange={(v) => set({ withheld: v })} />
              </Field>
            </div>
          </fieldset>
        );
      })}

      <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: "ADD_INCOME" })}>
        + Добавить работодателя
      </button>

      {totalIncome > 0 && (
        <p className="wiz__note" style={{ marginTop: 12 }}>
          Итого за год: доход {fmtRub(totalIncome)}, удержано налога {fmtRub(totalWithheld)}.
        </p>
      )}
    </div>
  );
}
