import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { sendFormEmail } from "../lib/mailer.js";
import {
  getAccount,
  updateAccount,
  isLoggedIn,
  setLoggedIn,
  hashPassword,
} from "../lib/account.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";
// eslint-disable-next-line no-unused-vars — прямой fetch остаётся для смены пароля

// Логин — почта или ID клиента.
function matchesAccount(account, login) {
  const v = login.trim().toLowerCase();
  return (
    v === account.email.trim().toLowerCase() || v === String(account.id)
  );
}

export default function Login() {
  const navigate = useNavigate();
  const account = getAccount();

  // mode: "login" | "recover" | "reset" | "requested"
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!login.trim() || !password) {
      setError("Укажите логин (почту или ID) и пароль.");
      return;
    }
    if (!account || !matchesAccount(account, login)) {
      setError(
        "Кабинет с таким логином не найден в этом браузере. Проверьте данные, зарегистрируйтесь или воспользуйтесь восстановлением пароля."
      );
      return;
    }
    setBusy(true);
    const hash = await hashPassword(password);
    if (!account.passwordHash) {
      // Кабинет создан до появления входа — принимаем пароль и сохраняем его.
      updateAccount({ passwordHash: hash });
    } else if (account.passwordHash !== hash) {
      setBusy(false);
      setError("Неверный логин или пароль.");
      return;
    }
    setLoggedIn(true);
    setBusy(false);
    navigate("/kabinet");
  }

  async function handleRecover(e) {
    e.preventDefault();
    setError("");
    if (!login.trim()) {
      setError("Укажите почту или ID клиента.");
      return;
    }
    if (account && matchesAccount(account, login)) {
      // Кабинет в этом браузере — даём задать новый пароль сразу.
      setMode("reset");
      return;
    }
    // Кабинет на другом устройстве/браузере — заявка специалисту.
    setBusy(true);
    try {
      // Письмо, а при сбое почты — резервная запись в базу.
      await sendFormEmail("Запрос восстановления пароля", {
        "Логин (почта или ID)": login.trim(),
      });
      setMode("requested");
    } catch {
      setError(
        "Не удалось отправить запрос — почтовый сервис временно недоступен. Позвоните нам: +7 (920) 837-91-93 или напишите в Telegram/Max (кнопка чата справа внизу)."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    if (!newPassword) {
      setError("Придумайте новый пароль.");
      return;
    }
    setBusy(true);
    const hash = await hashPassword(newPassword);
    updateAccount({ passwordHash: hash });
    setLoggedIn(true);
    // Уведомляем менеджера (не блокируем вход).
    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `Клиент сменил пароль — ID ${account.id}`,
        _template: "table",
        _captcha: "false",
        "ID клиента": String(account.id),
        "Email": account.email,
      }),
    }).catch(() => {});
    setBusy(false);
    navigate("/kabinet");
  }

  const already = account && isLoggedIn();

  return (
    <>
      <Seo
        title="Вход в личный кабинет | Налог-сервис"
        description="Войдите в личный кабинет Налог-сервис по почте или ID клиента."
        path="/vhod"
        noindex
      />
      <PageHero
        eyebrow="Личный кабинет"
        title="Вход в кабинет"
        subtitle="Используйте почту или ID клиента, выданный при регистрации."
        crumbs={["Вход"]}
      />

      <section className="section">
        <div className="container">
          <div className="auth">
            {already && mode === "login" && (
              <p className="doc-note doc-note--ok" style={{ marginBottom: 18 }}>
                Вы уже вошли как <strong>{account.email}</strong> (ID {account.id}).{" "}
                <Link to="/kabinet" style={{ textDecoration: "underline" }}>
                  Открыть кабинет →
                </Link>
              </p>
            )}

            {mode === "login" && (
              <form className="form" onSubmit={handleLogin} noValidate>
                <div className="form__field">
                  <label htmlFor="lg-login">Почта или ID клиента</label>
                  <input
                    id="lg-login"
                    type="text"
                    autoComplete="username"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="you@example.com или 789264116"
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="lg-pass">Пароль</label>
                  <div className="pass-wrap">
                    <input
                      id="lg-pass"
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ваш пароль"
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
                </div>

                {error && (
                  <span className="form__error" role="alert">
                    {error}
                  </span>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block btn--lg"
                  disabled={busy}
                >
                  {busy ? "Проверяем…" : "Войти"}
                </button>

                <div className="auth__links">
                  <button
                    type="button"
                    className="auth__link"
                    onClick={() => {
                      setMode("recover");
                      setError("");
                    }}
                  >
                    Забыли пароль?
                  </button>
                  <Link to="/registraciya" className="auth__link">
                    Нет кабинета? Зарегистрируйтесь
                  </Link>
                </div>
              </form>
            )}

            {mode === "recover" && (
              <form className="form" onSubmit={handleRecover} noValidate>
                <h3 style={{ fontSize: 20 }}>Восстановление пароля</h3>
                <p style={{ color: "var(--ink-500)", fontSize: 15 }}>
                  Укажите почту или ID клиента — поможем восстановить доступ.
                </p>
                <div className="form__field">
                  <label htmlFor="rc-login">Почта или ID клиента</label>
                  <input
                    id="rc-login"
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="you@example.com или 789264116"
                  />
                </div>

                {error && (
                  <span className="form__error" role="alert">
                    {error}
                  </span>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block btn--lg"
                  disabled={busy}
                >
                  {busy ? "Отправляем…" : "Восстановить пароль"}
                </button>
                <div className="auth__links">
                  <button
                    type="button"
                    className="auth__link"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                  >
                    ← Назад ко входу
                  </button>
                </div>
              </form>
            )}

            {mode === "reset" && (
              <form className="form" onSubmit={handleReset} noValidate>
                <h3 style={{ fontSize: 20 }}>Задайте новый пароль</h3>
                <p style={{ color: "var(--ink-500)", fontSize: 15 }}>
                  Кабинет <strong>{login.trim()}</strong> найден в этом браузере —
                  придумайте новый пароль.
                </p>
                <div className="form__field">
                  <label htmlFor="rs-pass">Новый пароль</label>
                  <div className="pass-wrap">
                    <input
                      id="rs-pass"
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Новый пароль"
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
                </div>

                {error && (
                  <span className="form__error" role="alert">
                    {error}
                  </span>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--block btn--lg"
                  disabled={busy}
                >
                  {busy ? "Сохраняем…" : "Сохранить и войти"}
                </button>
              </form>
            )}

            {mode === "requested" && (
              <div className="form__success">
                <div className="form__success-icon">✓</div>
                <h3>Запрос отправлен</h3>
                <p style={{ color: "var(--ink-500)", margin: "10px 0 20px" }}>
                  Мы получили запрос на восстановление доступа для{" "}
                  <strong>{login.trim()}</strong>. Специалист свяжется с вами и
                  поможет восстановить кабинет. Если вы регистрировались на этом
                  устройстве, попробуйте также{" "}
                  <button
                    type="button"
                    className="auth__link"
                    style={{ display: "inline", padding: 0 }}
                    onClick={() => {
                      setMode("recover");
                      setError("");
                    }}
                  >
                    восстановить пароль здесь
                  </button>
                  .
                </p>
                <Link to="/" className="btn btn--ghost">
                  На главную
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
