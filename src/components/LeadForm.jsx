import { useState } from "react";
import { Link } from "react-router-dom";
import { deductions } from "../data/content.js";

const EMPTY = { name: "", phone: "", situation: deductions[0].title, comment: "" };

// Форма заявки с валидацией и согласием на обработку ПДн.
// Реального бэкенда нет — при отправке показываем подтверждение.
export default function LeadForm({ compact = false, title = "Оставьте заявку" }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);

  function validate(v) {
    const e = {};
    if (!v.name.trim()) e.name = "Укажите имя";
    const digits = v.phone.replace(/\D/g, "");
    if (digits.length < 10) e.phone = "Введите корректный телефон";
    if (!consent) e.consent = "Необходимо согласие";
    return e;
  }

  function change(el) {
    const { name, value } = el.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  }

  function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setSent(true);
      setForm(EMPTY);
      setConsent(false);
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
        <label htmlFor="lf-name">Ваше имя</label>
        <input
          id="lf-name"
          name="name"
          value={form.name}
          onChange={change}
          className={errors.name ? "is-error" : ""}
          placeholder="Как к вам обращаться?"
        />
        {errors.name && <span className="form__error">{errors.name}</span>}
      </div>

      <div className="form__field">
        <label htmlFor="lf-phone">Телефон</label>
        <input
          id="lf-phone"
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
            <label htmlFor="lf-situation">Ваша ситуация</label>
            <select id="lf-situation" name="situation" value={form.situation} onChange={change}>
              {deductions.map((d) => (
                <option key={d.slug} value={d.title}>
                  {d.title}
                </option>
              ))}
              <option value="Иная ситуация">Иная ситуация</option>
            </select>
          </div>
          <div className="form__field">
            <label htmlFor="lf-comment">Комментарий (необязательно)</label>
            <textarea
              id="lf-comment"
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

      <button type="submit" className="btn btn--primary btn--block btn--lg">
        Получить консультацию
      </button>
    </form>
  );
}
