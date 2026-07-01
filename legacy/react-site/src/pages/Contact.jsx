import { useState } from "react";
import PageHero from "../components/PageHero.jsx";

const EMPTY = { name: "", email: "", message: "" };

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  function validate(values) {
    const next = {};
    if (!values.name.trim()) next.name = "Укажите имя";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      next.email = "Введите корректный e-mail";
    if (values.message.trim().length < 10)
      next.message = "Опишите задачу подробнее (минимум 10 символов)";
    return next;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      // Демо: реального бэкенда нет — просто показываем подтверждение.
      setSent(true);
      setForm(EMPTY);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Контакты"
        title="Расскажите о проекте"
        subtitle="Заполните форму или напишите на почту — ответим в течение рабочего дня."
      />

      <section className="section">
        <div className="container contact">
          <div className="contact__info">
            <h3>Прямые контакты</h3>
            <ul className="contact__list">
              <li>
                <span>E-mail</span>
                <a href="mailto:hello@nebula.studio">hello@nebula.studio</a>
              </li>
              <li>
                <span>Телефон</span>
                <a href="tel:+70000000000">+7 (000) 000-00-00</a>
              </li>
              <li>
                <span>Telegram</span>
                <a href="https://t.me/nebulastudio">@nebulastudio</a>
              </li>
              <li>
                <span>Город</span>
                <span>Москва · работаем удалённо</span>
              </li>
            </ul>
          </div>

          <div className="contact__form-wrap">
            {sent ? (
              <div className="contact__success" role="status">
                <div className="contact__success-icon">✓</div>
                <h3>Заявка отправлена!</h3>
                <p>Спасибо — мы свяжемся с вами в ближайшее время.</p>
                <button
                  className="btn btn--ghost"
                  onClick={() => setSent(false)}
                >
                  Отправить ещё одну
                </button>
              </div>
            ) : (
              <form className="form" onSubmit={handleSubmit} noValidate>
                <div className="form__field">
                  <label htmlFor="name">Имя</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    className={errors.name ? "is-error" : ""}
                    placeholder="Как вас зовут?"
                  />
                  {errors.name && (
                    <span className="form__error">{errors.name}</span>
                  )}
                </div>

                <div className="form__field">
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={errors.email ? "is-error" : ""}
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <span className="form__error">{errors.email}</span>
                  )}
                </div>

                <div className="form__field">
                  <label htmlFor="message">Сообщение</label>
                  <textarea
                    id="message"
                    name="message"
                    rows="5"
                    value={form.message}
                    onChange={handleChange}
                    className={errors.message ? "is-error" : ""}
                    placeholder="Коротко о задаче, сроках и бюджете"
                  />
                  {errors.message && (
                    <span className="form__error">{errors.message}</span>
                  )}
                </div>

                <button type="submit" className="btn btn--primary btn--lg">
                  Отправить заявку
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
