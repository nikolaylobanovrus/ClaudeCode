import { useCallback, useEffect, useState } from "react";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  sbConfigured,
  sbOperatorLogin,
  sbListClients,
  sbSetPayment,
  getOperatorToken,
  setOperatorToken,
} from "../lib/supabase.js";
import { tariffs } from "../data/content.js";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

// Тарифы с числовой суммой (из прайса).
const TARIFFS = tariffs.map((t) => ({
  name: t.name,
  amount: Number(t.price.replace(/\D/g, "")),
}));
const fmtRub = (n) => Number(n || 0).toLocaleString("ru-RU") + " ₽";

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

  // Назначить тариф и сумму (или сбросить: tariff="", amount=0).
  async function assignPayment(client, tariff, amount) {
    const prev = { tariff: client.tariff, amount: client.amount };
    setClients((list) =>
      list.map((c) => (c.id === client.id ? { ...c, tariff, amount } : c))
    );
    try {
      await sbSetPayment(token, client.id, { tariff, amount });
    } catch (e) {
      setClients((list) =>
        list.map((c) => (c.id === client.id ? { ...c, ...prev } : c))
      );
      if (e.status === 401) logout();
      else setError(`Не удалось обновить сумму клиента ${client.id}.`);
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
        subtitle="База клиентов: выберите тариф или задайте сумму — у клиента появится кнопка оплаты."
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
                      <th>Тариф и сумма к оплате</th>
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
                          <PaymentPicker client={c} onAssign={assignPayment} />
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

// Выбор тарифа/суммы в строке клиента: 3 тарифа, своя сумма, сброс.
function PaymentPicker({ client, onAssign }) {
  const [custom, setCustom] = useState("");
  const active = Number(client.amount || 0);
  const assigned = active > 0;

  function applyCustom(e) {
    e.preventDefault();
    const val = Number(String(custom).replace(/\D/g, ""));
    if (val > 0) {
      onAssign(client, "Своя сумма", val);
      setCustom("");
    }
  }

  return (
    <div className="op__pay">
      <div className="op__tariffs">
        {TARIFFS.map((t) => (
          <button
            key={t.name}
            type="button"
            className={
              "op__tbtn" +
              (client.tariff === t.name && active === t.amount ? " is-on" : "")
            }
            onClick={() => onAssign(client, t.name, t.amount)}
            title={`${t.name} — ${fmtRub(t.amount)}`}
          >
            {t.name}
            <span>{fmtRub(t.amount)}</span>
          </button>
        ))}
      </div>
      <form className="op__custom" onSubmit={applyCustom}>
        <input
          type="text"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Своя сумма, ₽"
          aria-label="Своя сумма"
        />
        <button type="submit" className="btn btn--ghost">
          Задать
        </button>
      </form>
      <div className="op__assigned">
        {assigned ? (
          <>
            <span className="op__badge">
              ✓ {client.tariff || "Сумма"} · {fmtRub(active)}
            </span>
            <button
              type="button"
              className="op__clear"
              onClick={() => onAssign(client, "", 0)}
            >
              Сбросить
            </button>
          </>
        ) : (
          <span className="op__none">не выставлено</span>
        )}
      </div>
    </div>
  );
}
