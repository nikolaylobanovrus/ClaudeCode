import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  sbConfigured,
  sbOperatorLogin,
  sbListClients,
  sbSetPayment,
  sbListClientFiles,
  sbDownloadClientFile,
  sbDeleteClientFiles,
  sbDeleteClient,
  sbListLeads,
  sbMarkLeadProcessed,
  getOperatorToken,
  setOperatorToken,
  operatorTokenExpiresAt,
  sbOperatorRefresh,
} from "../lib/supabase.js";
import { downloadBlob } from "../lib/share.js";
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
  // ready=false, пока не проверили, не пора ли продлить сохранённый токен при
  // открытии вкладки — иначе load() успеет уйти с протухшим токеном и словит 401.
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
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
        // Заявки-резерв (почта лежала): таблица может отсутствовать, если
        // миграция leads не применена — тогда просто пустой блок.
        setLeads(await sbListLeads(t).catch(() => []));
      } catch (e) {
        if (e.status === 401) logout();
        else setError("Не удалось загрузить базу. Попробуйте обновить страницу.");
      } finally {
        setBusy(false);
      }
    },
    [logout]
  );

  // Бутстрап при открытии вкладки: если сохранённый access_token уже истёк
  // (или вот-вот истечёт), но refresh_token жив — продлеваем ДО первой загрузки,
  // восстанавливая сессию вместо выброса на форму входа.
  useEffect(() => {
    let alive = true;
    (async () => {
      const exp = operatorTokenExpiresAt();
      if (getOperatorToken() && exp && exp - Date.now() < 120000) {
        const fresh = await sbOperatorRefresh();
        if (!alive) return;
        if (fresh) setToken(fresh);
        else logout(); // refresh отклонён — сессии нет
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
    // Один раз на монтирование — logout стабилен (useCallback []).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && token) load(token);
  }, [ready, token, load]);

  // Фоновое автопродление: пока открыта вкладка, обновляем access_token за
  // 2 мин до истечения. setToken(fresh) перезапускает эффект → следующий цикл.
  useEffect(() => {
    if (!ready || !token) return;
    let alive = true;
    const exp = operatorTokenExpiresAt();
    // exp=0 (legacy без refresh) — продлить нельзя, таймер не ставим.
    const delay = exp ? Math.max(5000, exp - Date.now() - 120000) : Infinity;
    if (!Number.isFinite(delay)) return;
    const timer = setTimeout(async () => {
      const fresh = await sbOperatorRefresh();
      if (!alive) return;
      if (fresh) setToken(fresh);
      else logout();
    }, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, token, logout]);

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

  // Удаление клиента: сначала его файлы из хранилища, затем запись из базы.
  // Подтверждение — на кнопке (действие необратимо).
  async function removeClient(client) {
    if (
      !window.confirm(
        `Удалить клиента ${client.id} (${client.email || "без email"}) и все его файлы? Действие необратимо.`
      )
    )
      return;
    setError("");
    try {
      await sbDeleteClientFiles(token, client.id).catch(() => {
        /* файлов могло не быть или хранилище не настроено — запись всё равно удаляем */
      });
      await sbDeleteClient(token, client.id);
      setClients((list) => list.filter((c) => c.id !== client.id));
    } catch (e) {
      if (e.status === 401) logout();
      else
        setError(
          `Не удалось удалить клиента ${client.id}. Проверьте, что применена миграция docs/supabase-migration-operator-delete.sql.`
        );
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
                <Link className="btn btn--ghost" to="/deklaraciya/anketa">
                  Создать декларацию в мастере
                </Link>
                <button className="btn btn--ghost" onClick={logout}>
                  Выйти
                </button>
              </div>

              {leads.length > 0 && (
                <div className="op__leads">
                  <h3 className="op__leads-title">
                    Заявки с сайта (почта была недоступна) — {leads.length}
                  </h3>
                  {leads.map((l) => (
                    <div className="op__lead" key={l.id}>
                      <div className="op__lead-head">
                        <strong>{l.kind}</strong>
                        <span className="op__lead-date">
                          {new Date(l.created_at).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <dl className="op__lead-fields">
                        {Object.entries(l.payload || {}).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={async () => {
                          try {
                            await sbMarkLeadProcessed(token, l.id);
                            setLeads((cur) => cur.filter((x) => x.id !== l.id));
                          } catch {
                            setError("Не удалось отметить заявку. Обновите страницу.");
                          }
                        }}
                      >
                        ✓ Обработано
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                      <th>Файлы</th>
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
                          <ClientFiles client={c} token={token} />
                        </td>
                        <td>
                          <PaymentPicker client={c} onAssign={assignPayment} />
                          <button
                            type="button"
                            className="op__clear op__delete"
                            onClick={() => removeClient(c)}
                          >
                            Удалить клиента
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ color: "var(--ink-500)" }}>
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

// Файлы клиента из защищённого хранилища: список по клику, скачивание.
function ClientFiles({ client, token }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = ещё не загружали
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items !== null) return;
    setBusy(true);
    setErr("");
    try {
      setItems(await sbListClientFiles(token, client.id));
    } catch {
      setErr("Не удалось получить список (проверьте миграцию хранилища).");
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  async function download(name) {
    setErr("");
    try {
      const blob = await sbDownloadClientFile(token, client.id, name);
      downloadBlob(blob, name, blob.type || "application/octet-stream");
    } catch {
      setErr("Не удалось скачать файл.");
    }
  }

  // Удаление всех файлов клиента из хранилища (запись клиента остаётся).
  async function removeAll() {
    if (
      !window.confirm(
        `Удалить все файлы клиента ${client.id}? Действие необратимо.`
      )
    )
      return;
    setErr("");
    setBusy(true);
    try {
      await sbDeleteClientFiles(token, client.id);
      setItems([]);
    } catch {
      setErr(
        "Не удалось удалить файлы. Проверьте, что применена миграция docs/supabase-migration-operator-delete.sql."
      );
    } finally {
      setBusy(false);
    }
  }

  const fmtSize = (b) =>
    b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + " МБ" : Math.ceil(b / 1024) + " КБ";

  return (
    <div className="op__files">
      <button type="button" className="btn btn--ghost op__files-btn" onClick={toggle}>
        {open ? "Скрыть" : busy ? "…" : "Показать"}
      </button>
      {open && (
        <div className="op__files-list">
          {busy && <span className="op__none">Загружаем…</span>}
          {err && <span className="form__error">{err}</span>}
          {items && items.length === 0 && !busy && !err && (
            <span className="op__none">файлов нет</span>
          )}
          {items?.map((f) => (
            <button
              key={f.name}
              type="button"
              className="op__file"
              title="Скачать"
              onClick={() => download(f.name)}
            >
              ⬇ {f.name}
              {f.metadata?.size ? ` (${fmtSize(f.metadata.size)})` : ""}
            </button>
          ))}
          {items && items.length > 0 && !busy && (
            <button type="button" className="op__clear" onClick={removeAll}>
              Удалить все файлы
            </button>
          )}
        </div>
      )}
    </div>
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
