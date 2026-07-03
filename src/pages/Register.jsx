import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  getAccount,
  saveAccount,
  generateClientId,
  hashPassword,
  setLoggedIn,
} from "../lib/account.js";
import { maskRuPhone, isCompleteRuPhone } from "../lib/phone.js";
import { sbRpc } from "../lib/supabase.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";

export default function Register() {
  const navigate = useNavigate();
  const existing = getAccount();

  const [form, setForm] = useState({ email: "", phone: "", password: "" });
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  function validate(v) {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
      e.email = "Укажите корректный e-mail — он будет вашим логином";
    if (!v.password) e.password = "Придумайте пароль";
    if (v.phone && !isCompleteRuPhone(v.phone))
      e.phone = "Телефон указан не полностью";
    if (!consent) e.consent = "Необходимо согласие";
    return e;
  }

  function change(e) {
    const { name, value } = e.target;
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
    const id = generateClientId();
    try {
      // Пароль в письмо намеренно не включается — открытая передача паролей
      // по почте небезопасна.
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `Регистрация нового клиента — ID ${id}`,
          _template: "table",
          _captcha: "false",
          "ID клиента": String(id),
          "Email (логин)": form.email,
          "Телефон": form.phone || "не указан",
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      saveAccount({
        id,
        email: form.email,
        phone: form.phone,
        passwordHash: await hashPassword(form.password),
        createdAt: new Date().toISOString(),
      });
      setLoggedIn(true);
      // Заводим клиента в базе (кабинет оператора); сбой не мешает регистрации.
      const phoneDigits = form.phone.replace(/\D/g, "");
      sbRpc("register_client", {
        p_id: id,
        p_email: form.email,
        p_phone: phoneDigits ? "+" + phoneDigits : "",
      }).catch(() => {});
      navigate("/vyberite-situaciyu");
    } catch {
      setSendError(
        "Не удалось завершить регистрацию. Попробуйте ещё раз или позвоните нам: +7 (920) 837-91-93."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Seo
        title="Регистрация — сформируйте декларацию 3-НДФЛ онлайн | Налог-сервис"
        description="Создайте личный кабинет за минуту: укажите e-mail и пароль, выберите свою ситуацию — и мы подготовим вашу декларацию 3-НДФЛ."
        path="/registraciya"
      />
      <PageHero
        eyebrow="Онлайн-сервис"
        title="Регистрация"
        subtitle="Создайте личный кабинет — это займёт меньше минуты. Дальше выберете ситуацию, и мы займёмся вашей декларацией."
        crumbs={["Регистрация"]}
      />

      <section className="section">
        <div className="container">
          <div className="auth">
            {existing ? (
              <div className="form__success">
                <div className="form__success-icon">✓</div>
                <h3>Вы уже зарегистрированы</h3>
                <p style={{ color: "var(--ink-500)", margin: "10px 0 20px" }}>
                  Ваш ID клиента: <strong>{existing.id}</strong> ({existing.email})
                </p>
                <div className="cta__actions">
                  <Link to="/vyberite-situaciyu" className="btn btn--primary">
                    Выбрать ситуацию
                  </Link>
                  <Link to="/kabinet" className="btn btn--ghost">
                    Личный кабинет
                  </Link>
                </div>
              </div>
            ) : (
              <form className="form" onSubmit={submit} noValidate>
                <div className="form__field">
                  <label htmlFor="reg-email">E-mail (логин) *</label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={change}
                    className={errors.email ? "is-error" : ""}
                    placeholder="you@example.com"
                  />
                  {errors.email && <span className="form__error">{errors.email}</span>}
                </div>

                <div className="form__field">
                  <label htmlFor="reg-phone">Телефон (необязательно)</label>
                  <input
                    id="reg-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={change}
                    className={errors.phone ? "is-error" : ""}
                    placeholder="+7 (___) ___-__-__"
                  />
                  {errors.phone && <span className="form__error">{errors.phone}</span>}
                </div>

                <div className="form__field">
                  <label htmlFor="reg-pass">Пароль *</label>
                  <div className="pass-wrap">
                    <input
                      id="reg-pass"
                      name="password"
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={change}
                      className={errors.password ? "is-error" : ""}
                      placeholder="Придумайте пароль"
                    />
                    <button
                      type="button"
                      className="pass-toggle"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="form__error">{errors.password}</span>
                  )}
                </div>

                <label className="form__consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (errors.consent)
                        setErrors((p) => ({ ...p, consent: undefined }));
                    }}
                  />
                  <span>
                    Принимаю условия{" "}
                    <Link to="/publichnaya-oferta">Публичной оферты</Link> и{" "}
                    <Link to="/politika-konfidencialnosti">
                      Политики конфиденциальности
                    </Link>
                    , даю согласие на обработку персональных данных.
                  </span>
                </label>
                {errors.consent && (
                  <span className="form__error">{errors.consent}</span>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block btn--lg"
                  disabled={sending}
                  style={sending ? { opacity: 0.7, cursor: "wait" } : undefined}
                >
                  {sending ? "Создаём кабинет…" : "Зарегистрироваться"}
                </button>

                {sendError && (
                  <span className="form__error" role="alert">
                    {sendError}
                  </span>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
