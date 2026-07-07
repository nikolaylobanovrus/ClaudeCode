import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { company } from "../data/content.js";
import { ymGoal } from "../lib/metrika.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";

// Плавающий чат помощи (справа снизу): кнопки перехода в Telegram/Max —
// клиент пишет из своего мессенджера, сообщения приходят оператору нативно —
// плюс мини-форма вопроса, уходящая на email (FormSubmit).
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) {
      setError("Укажите телефон — мы перезвоним или напишем.");
      return;
    }
    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: "Вопрос из чата на сайте",
          _template: "table",
          _captcha: "false",
          "Телефон": phone.trim(),
          "Вопрос": question.trim() || "—",
          "Страница": window.location.hash || window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      ymGoal("chat_question");
      setSent(true);
    } catch {
      setError("Не удалось отправить. Напишите нам в мессенджер или позвоните.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chatw">
      {open && (
        <div className="chatw__panel" role="dialog" aria-label="Чат помощи">
          <div className="chatw__head">
            <div>
              <strong>Налог-сервис</strong>
              <span className="chatw__status">обычно отвечаем в течение часа</span>
            </div>
            <button
              type="button"
              className="chatw__close"
              aria-label="Закрыть чат"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <p className="chatw__hello">
            Здравствуйте! 👋 Подскажем по вычетам и декларации 3-НДФЛ. Напишите
            нам в удобный мессенджер:
          </p>

          {company.telegram && (
            <a
              className="chatw__msgr chatw__msgr--tg"
              href={company.telegram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => ymGoal("chat_messenger", { messenger: "telegram" })}
            >
              Написать в Telegram
            </a>
          )}
          <a
            className="chatw__msgr chatw__msgr--max"
            href={company.max}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => ymGoal("chat_messenger", { messenger: "max" })}
          >
            Написать в Max
          </a>

          <div className="chatw__or">или оставьте вопрос здесь</div>

          {sent ? (
            <div className="doc-note doc-note--ok" role="status">
              ✓ Спасибо! Мы получили ваш вопрос и ответим в ближайшее время.
            </div>
          ) : (
            <form className="chatw__form" onSubmit={submit}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ваш телефон *"
                aria-label="Телефон"
              />
              <textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ваш вопрос"
                aria-label="Вопрос"
              />
              <label className="chatw__consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Согласен(на) с{" "}
                  <Link to="/politika-konfidencialnosti">
                    Политикой конфиденциальности
                  </Link>{" "}
                  и обработкой персональных данных
                </span>
              </label>
              {error && (
                <span className="form__error" role="alert">
                  {error}
                </span>
              )}
              <button type="submit" className="btn btn--primary" disabled={sending}>
                {sending ? "Отправляем…" : "Отправить"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        className={"chatw__fab" + (open ? " is-open" : "")}
        aria-label={open ? "Закрыть чат помощи" : "Открыть чат помощи"}
        aria-expanded={open}
        onClick={() => setOpen((v) => { if (!v) ymGoal("chat_open"); return !v; })}
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
