// Шаг 2: данные налогоплательщика — попадают на титульный лист декларации
// и в заявление о возврате.
import { useWizard } from "../WizardContext.jsx";
import { HINTS } from "../../data/wizard.js";
import { Field, TextInput, DateInput } from "../fields.jsx";
import { maskRuPhone } from "../../lib/phone.js";
import AddressLookup from "../AddressLookup.jsx";
import { useFeatureFlag } from "../../lib/featureFlags.js";

export default function StepPersonal({ errors }) {
  const { draft, dispatch } = useWizard();
  const p = draft.personal;
  const set = (patch) => dispatch({ type: "PATCH", section: "personal", patch });
  // При включённом определении по адресу подсказки к ИФНС/ОКТМО ссылаются
  // на поле адреса; при выключенном — прежний текст (поля адреса нет).
  const addressOn = useFeatureFlag("address_lookup");
  const hintIfns = addressOn
    ? "4 цифры — код инспекции по месту прописки. Проще всего — начните вводить адрес прописки выше, код определится сам."
    : HINTS.ifns;
  const hintOktmo = addressOn
    ? "Определяется по адресу прописки выше. Для сверки: код ОКТМО есть и в справке о доходах (раздел 1)."
    : HINTS.oktmo;

  return (
    <div>
      <div className="wiz__row">
        <Field label="Фамилия" error={errors.lastName}>
          <TextInput value={p.lastName} error={errors.lastName} autoComplete="family-name"
            onChange={(v) => set({ lastName: v })} />
        </Field>
        <Field label="Имя" error={errors.firstName}>
          <TextInput value={p.firstName} error={errors.firstName} autoComplete="given-name"
            onChange={(v) => set({ firstName: v })} />
        </Field>
        <Field label="Отчество (если есть)">
          <TextInput value={p.middleName} autoComplete="additional-name"
            onChange={(v) => set({ middleName: v })} />
        </Field>
      </div>

      <div className="wiz__row">
        <Field label="ИНН" hint={HINTS.inn} error={errors.inn}>
          <TextInput value={p.inn} error={errors.inn} inputMode="numeric" maxLength={12}
            placeholder="12 цифр" onChange={(v) => set({ inn: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="Дата рождения" error={errors.birthDate}>
          <DateInput value={p.birthDate} error={errors.birthDate}
            onChange={(v) => set({ birthDate: v })} />
        </Field>
        <Field label="Место рождения">
          <TextInput value={p.birthPlace} placeholder="как в паспорте"
            onChange={(v) => set({ birthPlace: v })} />
        </Field>
      </div>

      <h3 className="wiz__subhead">Паспорт</h3>
      <div className="wiz__row">
        <Field label="Серия" error={errors.passportSeries}>
          <TextInput value={p.passportSeries} error={errors.passportSeries} inputMode="numeric"
            maxLength={4} placeholder="0000"
            onChange={(v) => set({ passportSeries: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="Номер" error={errors.passportNumber}>
          <TextInput value={p.passportNumber} error={errors.passportNumber} inputMode="numeric"
            maxLength={6} placeholder="000000"
            onChange={(v) => set({ passportNumber: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="Дата выдачи" error={errors.passportDate}>
          <DateInput value={p.passportDate} error={errors.passportDate}
            onChange={(v) => set({ passportDate: v })} />
        </Field>
      </div>
      <Field label="Кем выдан" hint={HINTS.passportIssuer} error={errors.passportIssuer}>
        <TextInput value={p.passportIssuer} error={errors.passportIssuer}
          onChange={(v) => set({ passportIssuer: v })} />
      </Field>

      <h3 className="wiz__subhead">Налоговая по месту прописки</h3>
      <AddressLookup />
      <div className="wiz__row">
        <Field label="Код инспекции (ИФНС)" hint={hintIfns} error={errors.ifns}>
          <TextInput value={p.ifns} error={errors.ifns} inputMode="numeric" maxLength={4}
            placeholder="7701" onChange={(v) => set({ ifns: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="ОКТМО" hint={hintOktmo} error={errors.oktmo}>
          <TextInput value={p.oktmo} error={errors.oktmo} inputMode="numeric" maxLength={11}
            placeholder="8 или 11 цифр" onChange={(v) => set({ oktmo: v.replace(/\D/g, "") })} />
        </Field>
        <Field label="Телефон" error={errors["phone"]}>
          <TextInput value={p.phone} autoComplete="tel" placeholder="+7 (900) 000-00-00"
            error={errors["phone"]}
            onChange={(v) => set({ phone: maskRuPhone(v, p.phone) })} />
        </Field>
      </div>
    </div>
  );
}
