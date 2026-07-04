// Шаг 5: реквизиты для возврата — попадают в заявление о распоряжении
// (возврат положительного сальдо ЕНС).
import { useWizard } from "../WizardContext.jsx";
import { HINTS } from "../../data/wizard.js";
import { Field, TextInput } from "../fields.jsx";
import { accountKindWarning } from "../validation.js";

export default function StepBank({ errors }) {
  const { draft, dispatch } = useWizard();
  const b = draft.bank;
  const set = (patch) => dispatch({ type: "PATCH", section: "bank", patch });
  const warn = !errors.account && accountKindWarning(b.account);

  return (
    <div>
      <p className="wiz__note">
        Возврат придёт на ваш банковский счёт. Реквизиты есть в приложении банка:
        «Реквизиты счёта» или «Реквизиты для перевода».
      </p>
      <div className="wiz__row">
        <Field label="БИК банка" hint={HINTS.bik} error={errors.bik}>
          <TextInput value={b.bik} error={errors.bik} inputMode="numeric" maxLength={9}
            placeholder="044525225" onChange={(v) => set({ bik: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="Номер счёта (не карты!)" hint={HINTS.account} error={errors.account}>
          <TextInput value={b.account} error={errors.account} inputMode="numeric" maxLength={20}
            placeholder="40817810…" onChange={(v) => set({ account: v.replace(/\D/g, "") })} />
        </Field>
      </div>
      {warn && <div className="doc-note doc-note--err">{warn}</div>}
    </div>
  );
}
