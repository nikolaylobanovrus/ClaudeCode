import { useCallback, useEffect, useState } from "react";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  sbConfigured,
  sbOperatorLogin,
  sbListClients,
  sbSetDeclaration,
  getOperatorToken,
  setOperatorToken,
} from "../lib/supabase.js";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export default function Operator() {
  const [token, setToken] = useState(getOperatorToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    setOperatorToken("");
    setToken("");
    setClients([]);
  }, []);

  const load = useCallback(
    async (t) => {
      setBusy(true);
      setError("");
      try {
        setClients(await sbListClients(t));
      } catch (e) {
        if (e.status === 401) logout();
        else setError("Не удалось загрузить базу. Попробуйте обновить страницу.");
      } finally {
        setBusy(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Укажите email и пароль оператора.");
      return;
    }
    setBusy(true);
    try {
      const t = await sbOperatorLogin(email.trim(), password);
      setToken(t);
      setPassword("");
    } catch {
      setError("Неверный email или пароль.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDeclaration(client) {
    const next = !client.declaration_sent;
    // оптимистичное обновление
    setClients((list) =>
      list.map((c) => (c.id === client.id ? { ...c, declaration_sent: next } : c))
    );
    try {
      await sbSetDeclaration(token, client.id, next);
    } catch (e) {
      // откат
      setClients((list) =>
        list.map((c) =>
          c.id === client.id ? { ...c, declaration_sent: !next } : c
        )
      );
      if (e.status === 401) logout();
      else setError(`Не удалось обновить статус клиента ${client.id}.`);
    }
  }

  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const filtered = clients.filter((c) => {
    if (!q) return true;
    if (String(c.id).includes(q)) return true;
    if (qDigits && (c.phone || "").replace(/\D/g, "").includes(qDigits))
      return true;
    return (c.email || "").toLowerCase().includes(q);
  });

  return (
    <>
      <Seo
        title="Кабинет оператора | Налог-сервис"
        description="Служебная страница оператора."
        path="/operator"
        noindex
      />
      <PageHero
        eyebrow="Служебная страница"
        title="Кабинет оператора"
        subtitle="База клиентов и статусы деклараций."
        crumbs={["Оператор"]}
      />

      <section className="section">
        <div className="container">
          {!sbConfigured() ? (
            <div className="auth">
              <p className="doc-note doc-note--err">
                База клиентов не подключена. Добавьте URL и anon-ключ Supabase в
                конфигурацию — инструкция в docs/supabase-setup.md.
              </p>
            </div>
          ) : !token ? (
            <div className="auth">
              <form className="form" onSubmit={handleLogin} noValidate>
                <h3 style={{ fontSize: 20 }}>Вход для оператора</h3>
                <div className="form__field">
                  <label htmlFor="op-email">Email оператора</label>
                  <input
                    id="op-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@example.com"
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="op-pass">Пароль</label>
                  <input
                    id="op-pass"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль"
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
                  {busy ? "Проверяем…" : "Войти"}
                </button>
              </form>
            </div>
          ) : (
            <div className="op">
              <div className="op__toolbar">
                <input
                  className="op__search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск: ID, телефон или email"
                  aria-label="Поиск клиента"
                />
                <button
                  className="btn btn--ghost"
                  onClick={() => load(token)}
                  disabled={busy}
                >
                  {busy ? "Обновляем…" : "Обновить"}
                </button>
                <button className="btn btn--ghost" onClick={logout}>
                  Выйти
                </button>
              </div>

              {error && (
                <p className="doc-note doc-note--err" role="alert">
                  {error}
                </p>
              )}

              <div className="op__tablewrap">
                <table className="legal-table op__table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
                      <th>Телефон</th>
                      <th>Ситуация</th>
                      <th>Дата</th>
                      <th>Декларация</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.id}</strong>
                        </td>
                        <td>{c.email || "—"}</td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.situation || "—"}</td>
                        <td>{c.created_at ? fmtDate(c.created_at) : "—"}</td>
                        <td>
                          <button
                            type="button"
                            className={
                              "op__flag" + (c.declaration_sent ? " is-on" : "")
                            }
                            onClick={() => toggleDeclaration(c)}
                            title={
                              c.declaration_sent
                                ? "Снять отметку «Декларация направлена»"
                                : "Отметить «Декларация направлена»"
                            }
                          >
                            {c.declaration_sent ? "✓ Направлена" : "Отметить"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ color: "var(--ink-500)" }}>
                          {busy
                            ? "Загружаем…"
                            : q
                              ? "Ничего не найдено по запросу."
                              : "Клиентов пока нет — они появятся после регистраций на сайте."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
