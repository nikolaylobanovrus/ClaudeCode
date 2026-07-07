import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { deductions } from "../data/content.js";
import { maskRuPhone, isCompleteRuPhone } from "../lib/phone.js";
import { ymGoal } from "../lib/metrika.js";

const EMPTY = { name: "", phone: "", situation: deductions[0].title, comment: "" };

// Куда уходят заявки: FormSubmit.co пересылает POST-запросы на email
// без собственного бэкенда (сайт хостится статически).
const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";
const FORM_SUBJECT = "Консультация с сайта 2";

// Форма заявки с валидацией и согласием на обработку ПДн.
// Данные отправляются на email через FormSubmit.co.
export default function LeadForm({ compact = false, title = "Оставьте заявку" }) {
  // Уникальные id полей: на странице может быть несколько форм одновременно.
  const uid = useId();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  function validate(v) {
    const e = {};
    if (!v.name.trim()) e.name = "Укажите имя";
    if (!isCompleteRuPhone(v.phone)) e.phone = "Введите корректный телефон";
    if (!consent) e.consent = "Необходимо согласие";
    return e;
  }

  function change(el) {
    const { name, value } = el.target;
    setForm((f) => ({
      ...f,
      [name]: name === "phone" ? maskRuPhone(value, f.phone) : value,
    }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    setSendError("");
    try {
      const payload = {
        _subject: FORM_SUBJECT,
        _template: "table",
        _captcha: "false",
        "Имя": form.name,
        "Телефон": form.phone,
      };
      if (!compact) {
        payload["Ситуация"] = form.situation;
        if (form.comment.trim()) payload["Комментарий"] = form.comment;
      }
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      ymGoal("lead");
      setSent(true);
      setForm(EMPTY);
      setConsent(false);
    } catch {
      setSendError(
        "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам: +7 (920) 837-91-93."
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="form__success">
        <div className="form__success-icon">✓</div>
        <h3>Спасибо за заявку!</h3>
        <p style={{ color: "var(--ink-500)", marginTop: 8 }}>
          Специалист свяжется с вами в ближайшее время.
        </p>
        <button
          className="btn btn--ghost"
          style={{ marginTop: 16 }}
          onClick={() => setSent(false)}
        >
          Отправить ещё одну
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {title && <h3 style={{ fontSize: 22 }}>{title}</h3>}

      <div className="form__field">
        <label htmlFor={`${uid}-name`}>Ваше имя</label>
        <input
          id={`${uid}-name`}
          name="name"
          value={form.name}
          onChange={change}
          className={errors.name ? "is-error" : ""}
          placeholder="Как к вам обращаться?"
        />
        {errors.name && <span className="form__error">{errors.name}</span>}
      </div>

      <div className="form__field">
        <label htmlFor={`${uid}-phone`}>Телефон</label>
        <input
          id={`${uid}-phone`}
          name="phone"
          type="tel"
          value={form.phone}
          onChange={change}
          className={errors.phone ? "is-error" : ""}
          placeholder="+7 (___) ___-__-__"
        />
        {errors.phone && <span className="form__error">{errors.phone}</span>}
      </div>

      {!compact && (
        <>
          <div className="form__field">
            <label htmlFor={`${uid}-situation`}>Ваша ситуация</label>
            <select id={`${uid}-situation`} name="situation" value={form.situation} onChange={change}>
              {deductions.map((d) => (
                <option key={d.slug} value={d.title}>
                  {d.title}
                </option>
              ))}
              <option value="Иная ситуация">Иная ситуация</option>
            </select>
          </div>
          <div className="form__field">
            <label htmlFor={`${uid}-comment`}>Комментарий (необязательно)</label>
            <textarea
              id={`${uid}-comment`}
              name="comment"
              rows="3"
              value={form.comment}
              onChange={change}
              placeholder="Коротко о вашей ситуации"
            />
          </div>
        </>
      )}

      <label className="form__consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (errors.consent) setErrors((p) => ({ ...p, consent: undefined }));
          }}
        />
        <span>
          Принимаю условия{" "}
          <Link to="/publichnaya-oferta">Публичной оферты</Link> и{" "}
          <Link to="/politika-konfidencialnosti">Политики конфиденциальности</Link>,
          даю согласие на обработку персональных данных.
        </span>
      </label>
      {errors.consent && <span className="form__error">{errors.consent}</span>}

      <button
        type="submit"
        className="btn btn--primary btn--block btn--lg"
        disabled={sending}
        style={sending ? { opacity: 0.7, cursor: "wait" } : undefined}
      >
        {sending ? "Отправляем…" : "Получить консультацию"}
      </button>

      {sendError && (
        <span className="form__error" role="alert">
          {sendError}
        </span>
      )}
    </form>
  );
}
