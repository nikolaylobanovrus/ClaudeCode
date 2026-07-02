import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { getAccount, updateAccount, isLoggedIn } from "../lib/account.js";
import PaymentBlock from "../components/PaymentBlock.jsx";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";
// Вложения доставляются только нативной отправкой формы (multipart POST),
// AJAX-эндпоинт FormSubmit файлы отбрасывает — поэтому письма с файлами
// уходят через скрытый iframe.
const FORM_ENDPOINT_NATIVE = "https://formsubmit.co/nalog-service@internet.ru";
const DRAFT_KEY = "ns.draft.ipoteka.v1";
// Ограничение на суммарный размер вложений одного письма.
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.heic,.heif";

const FILE_FIELDS = [
  {
    key: "dogovor",
    label: "Договор купли-продажи",
    hint: "Можно фото или скан",
  },
  {
    key: "oplata",
    label: "Документ, подтверждающий оплату",
    hint: "Например, чек, выписка или расписка",
  },
  {
    key: "kredit",
    label: "Кредитный договор",
    hint: "Можно фото или скан",
  },
  {
    key: "procenty",
    label: "Справка об уплаченных процентах",
    hint: "Можно заказать ее в личном кабинете Банка",
  },
  {
    key: "ndfl",
    label: "Справка 2-НДФЛ",
    hint: "Можно заказать в бухгалтерии либо выгрузить из личного кабинета Налоговой",
  },
];

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}
function saveDraftStorage(d) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// Переключатель-«сегмент» из двух вариантов.
function Seg({ value, onChange, options, name }) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={"seg__btn" + (value === o.value ? " is-active" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SituationIpoteka() {
  const navigate = useNavigate();
  const account = getAccount();
  const draft = loadDraft();

  const [files, setFiles] = useState({});
  const [hints, setHints] = useState({});
  const [ndflMode, setNdflMode] = useState(draft?.ndflMode || "self");
  const [fnsLogin, setFnsLogin] = useState(draft?.fnsLogin || "");
  const [fnsPassword, setFnsPassword] = useState(draft?.fnsPassword || "");
  const [sendMode, setSendMode] = useState(draft?.sendMode || "self");
  const [sendMethod, setSendMethod] = useState(draft?.sendMethod || "paper");
  const [sendLogin, setSendLogin] = useState(draft?.sendLogin || "");
  const [sendPassword, setSendPassword] = useState(draft?.sendPassword || "");
  const [regAddress, setRegAddress] = useState(draft?.regAddress || "");
  const [draftFileNames, setDraftFileNames] = useState(draft?.fileNames || {});

  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const logged = isLoggedIn();
  useEffect(() => {
    if (!account) navigate("/registraciya", { replace: true });
    else if (!logged) navigate("/vhod", { replace: true });
  }, [account, logged, navigate]);

  if (!account || !logged) return null;

  const toggleHint = (key) => setHints((h) => ({ ...h, [key]: !h[key] }));

  function addFiles(key, list) {
    // FileList — живая коллекция: копируем сразу, до очистки input.value.
    const picked = Array.from(list);
    setFiles((f) => ({ ...f, [key]: [...(f[key] || []), ...picked] }));
    setError("");
  }
  function removeFile(key, idx) {
    setFiles((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  }

  function totalSize() {
    return Object.values(files)
      .flat()
      .reduce((s, f) => s + f.size, 0);
  }

  function buildFormData(kind) {
    const fd = new FormData();
    fd.append(
      "_subject",
      `ID ${account.id} — Платили Ипотеку${kind === "draft" ? " Черновик" : ""}`
    );
    fd.append("_template", "table");
    fd.append("_captcha", "false");
    fd.append("ID клиента", String(account.id));
    fd.append("Email клиента", account.email);
    if (account.phone) fd.append("Телефон клиента", account.phone);

    FILE_FIELDS.forEach((f) => {
      const list = files[f.key] || [];
      list.forEach((file, i) =>
        fd.append(list.length > 1 ? `${f.label} (${i + 1})` : f.label, file, file.name)
      );
      if (list.length === 0) {
        const prev = draftFileNames[f.key];
        if (prev?.length) {
          fd.append(f.label, `Отправлен ранее с черновиком: ${prev.join(", ")}`);
        } else if (f.key === "ndfl" && ndflMode === "us") {
          fd.append(f.label, "Клиент выбрал: «Получите за меня»");
        } else {
          fd.append(f.label, "не загружен");
        }
      }
    });

    fd.append(
      "Справка 2-НДФЛ — способ получения",
      ndflMode === "us" ? "Получите за меня" : "Получу сам"
    );
    if (ndflMode === "us") {
      fd.append("ФНС: Логин/ИНН", fnsLogin || "не указан");
      fd.append("ФНС: Пароль", fnsPassword || "не указан");
    }

    fd.append(
      "Подача документов в налоговую",
      sendMode === "self"
        ? "Отправлю в Налоговую сам"
        : sendMethod === "paper"
          ? "Отправьте за меня — на бумажном носителе"
          : "Отправьте за меня — через личный кабинет Налоговой"
    );
    if (sendMode === "us" && sendMethod === "cabinet") {
      fd.append(
        "ФНС для подачи: Логин/ИНН",
        sendLogin || (fnsLogin ? "указан выше" : "не указан")
      );
      fd.append(
        "ФНС для подачи: Пароль",
        sendPassword || (fnsPassword ? "указан выше" : "не указан")
      );
    }
    if (sendMode === "us") {
      fd.append("Адрес регистрации", regAddress.trim() || "не указан");
    }
    return fd;
  }

  // Нативная отправка multipart-формы в скрытый iframe: только так
  // FormSubmit доставляет вложения. Ответ iframe кросс-доменный и
  // нечитаем — считаем успехом событие load (плюс таймаут-страховка).
  function submitNativeForm(fd) {
    return new Promise((resolve, reject) => {
      let iframe = document.getElementById("fs-sink");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "fs-sink";
        iframe.name = "fs-sink";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
      }
      const form = document.createElement("form");
      form.action = FORM_ENDPOINT_NATIVE;
      form.method = "POST";
      form.enctype = "multipart/form-data";
      form.target = "fs-sink";
      form.style.display = "none";

      for (const [name, value] of fd.entries()) {
        if (value instanceof File) {
          const input = document.createElement("input");
          input.type = "file";
          input.name = name;
          const dt = new DataTransfer();
          dt.items.add(value);
          input.files = dt.files;
          form.appendChild(input);
        } else {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
      }

      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        form.remove();
        ok ? resolve() : reject(new Error("iframe timeout"));
      };
      iframe.addEventListener("load", () => finish(true), { once: true });
      // Страховка: load мог не сработать (например, оффлайн)
      setTimeout(() => finish(true), 12000);

      document.body.appendChild(form);
      form.submit();
    });
  }

  async function send(kind) {
    const fd = buildFormData(kind);
    const hasFiles = [...fd.values()].some((v) => v instanceof File);
    if (hasFiles) {
      await submitNativeForm(fd);
      return;
    }
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  }

  function persistDraft() {
    const names = { ...draftFileNames };
    FILE_FIELDS.forEach((f) => {
      const list = files[f.key] || [];
      if (list.length)
        names[f.key] = [...(names[f.key] || []), ...list.map((x) => x.name)];
    });
    saveDraftStorage({
      fileNames: names,
      ndflMode,
      fnsLogin,
      fnsPassword,
      sendMode,
      sendMethod,
      sendLogin,
      sendPassword,
      regAddress,
      savedAt: new Date().toISOString(),
    });
    setDraftFileNames(names);
    setFiles({});
  }

  async function handleSaveDraft() {
    setError("");
    setNotice("");
    if (totalSize() > MAX_TOTAL_BYTES) {
      setError("Файлы слишком большие (суммарно до 15 МБ за раз). Сохраните часть файлов, затем добавьте остальные.");
      return;
    }
    setSavingDraft(true);
    try {
      await send("draft");
      persistDraft();
      updateAccount({ situation: "Платили за ипотеку", docsStatus: "draft" });
      setNotice(
        "Черновик сохранён и отправлен нам. Заполненные данные сохранены — при следующем входе останется дозаполнить только пустые поля."
      );
    } catch {
      setError("Не удалось отправить черновик. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setNotice("");
    const hasAnyFiles =
      Object.values(files).some((l) => l?.length) ||
      Object.values(draftFileNames).some((l) => l?.length);
    if (!hasAnyFiles && ndflMode !== "us") {
      setError("Загрузите хотя бы один документ или выберите «Получите за меня» в справке 2-НДФЛ.");
      return;
    }
    if (ndflMode === "us" && (!fnsLogin || !fnsPassword)) {
      setError("Для варианта «Получите за меня» укажите Логин/ИНН и Пароль от личного кабинета Налоговой.");
      return;
    }
    if (
      sendMode === "us" &&
      sendMethod === "cabinet" &&
      !(sendLogin || fnsLogin) &&
      !(sendPassword || fnsPassword)
    ) {
      setError("Для подачи через личный кабинет Налоговой укажите Логин/ИНН и Пароль.");
      return;
    }
    if (sendMode === "us" && !regAddress.trim()) {
      setError("Укажите адрес регистрации — он необходим для определения Налоговой, в которую подаются документы.");
      return;
    }
    if (totalSize() > MAX_TOTAL_BYTES) {
      setError("Файлы слишком большие (суммарно до 15 МБ за раз). Сначала нажмите «Сохранить» с частью файлов, затем добавьте остальные и отправьте.");
      return;
    }
    setSubmitting(true);
    try {
      await send("final");
      clearDraftStorage();
      updateAccount({
        situation: "Платили за ипотеку",
        docsStatus: "sent",
        // Рекомендуемый тариф: подаём мы — «Премиум», иначе «Оптимальный».
        tariff: account.tariff || (sendMode === "us" ? "Премиум" : "Оптимальный"),
      });
      setDone(true);
      window.scrollTo(0, 0);
    } catch {
      setError("Не удалось отправить документы. Попробуйте ещё раз или позвоните нам: +7 (920) 837-91-93.");
    } finally {
      setSubmitting(false);
    }
  }

  const credsBlock = (login, setLogin, password, setPassword, note) => (
    <div className="creds">
      <p className="creds__trust">
        Доверяю вход в свой личный кабинет Налоговой вам в соответствии с{" "}
        <Link to="/politika-konfidencialnosti">Политикой конфиденциальности</Link>
      </p>
      <div className="form__field">
        <label>Логин/Мой ИНН</label>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="ИНН или логин от кабинета ФНС"
        />
      </div>
      <div className="form__field">
        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль от кабинета ФНС"
        />
      </div>
      {note && <p className="creds__note">* Если указывали выше, повторно указывать не требуется</p>}
    </div>
  );

  if (done) {
    return (
      <>
        <Seo title="Документы отправлены | Налог-сервис" description="Документы по ипотеке отправлены." path="/situaciya/ipoteka" noindex />
        <PageHero eyebrow={`ID клиента: ${account.id}`} title="Документы отправлены!" crumbs={["Платили за ипотеку"]} />
        <section className="section">
          <div className="container">
            <div className="auth form__success">
              <div className="form__success-icon">✓</div>
              <h3>Спасибо! Мы получили ваши документы</h3>
              <p style={{ color: "var(--ink-500)", margin: "10px 0 22px" }}>
                По готовности на <strong>{account.email}</strong> придут готовые
                документы: Декларация 3-НДФЛ и Заявление на налоговый вычет.
                Оплата — после готовности и вашей проверки документов.
              </p>
              <div className="cta__actions">
                <Link to="/kabinet" className="btn btn--primary">Личный кабинет</Link>
                <Link to="/" className="btn btn--ghost">На главную</Link>
              </div>
            </div>

            <div className="auth" style={{ marginTop: 24 }}>
              <PaymentBlock title="Оплата услуг" />
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Платили за ипотеку — загрузка документов | Налог-сервис"
        description="Загрузите документы для декларации 3-НДФЛ по процентам ипотеки — вернём до 390 000 ₽."
        path="/situaciya/ipoteka"
        noindex
      />
      <PageHero
        eyebrow={`ID клиента: ${account.id}`}
        title="Платили за ипотеку"
        subtitle="Вернём до 390 000 ₽ с уплаченных процентов. Загрузите документы — остальное сделаем мы."
        crumbs={["Выберите ситуацию", "Платили за ипотеку"]}
      />

      <section className="section">
        <div className="container docpage">
          <p className="docpage__intro">
            При оплате ипотеки можно вернуть налоговый вычет за уплаченные
            проценты по ипотеке в размере до <strong>390 000 руб.</strong>{" "}
            Необходимые документы для подготовки Декларации 3-НДФЛ:
          </p>

          {FILE_FIELDS.map((f) => {
            const list = files[f.key] || [];
            const prev = draftFileNames[f.key] || [];
            const isNdfl = f.key === "ndfl";
            return (
              <div className="up-field" key={f.key}>
                <div className="up-field__head">
                  <span className="up-field__label">{f.label}</span>
                  <button
                    type="button"
                    className="up-help"
                    aria-label={`Подсказка: ${f.label}`}
                    aria-expanded={!!hints[f.key]}
                    onClick={() => toggleHint(f.key)}
                  >
                    ?
                  </button>
                </div>
                {hints[f.key] && <p className="up-hint">{f.hint}</p>}

                {isNdfl && (
                  <Seg
                    name="Способ получения справки 2-НДФЛ"
                    value={ndflMode}
                    onChange={setNdflMode}
                    options={[
                      { value: "self", label: "Получу сам" },
                      { value: "us", label: "Получите за меня" },
                    ]}
                  />
                )}

                {(!isNdfl || ndflMode === "self") && (
                  <>
                    {prev.length > 0 && list.length === 0 && (
                      <p className="up-prev">
                        ✓ Отправлено с черновиком: {prev.join(", ")}
                      </p>
                    )}
                    <label className="up-drop">
                      <input
                        type="file"
                        multiple
                        accept={ACCEPT}
                        onChange={(e) => {
                          addFiles(f.key, e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <span className="up-drop__btn">📎 Загрузить файл</span>
                      <span className="up-drop__hint">фото, скан или PDF</span>
                    </label>
                    {list.length > 0 && (
                      <ul className="up-files">
                        {list.map((file, i) => (
                          <li key={i}>
                            <span>{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(f.key, i)}
                              aria-label={`Удалить ${file.name}`}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {isNdfl &&
                  ndflMode === "us" &&
                  credsBlock(fnsLogin, setFnsLogin, fnsPassword, setFnsPassword, false)}
              </div>
            );
          })}

          <div className="docpage__info">
            <p>
              По готовности вам на email <strong>{account.email}</strong> придут
              готовые документы: <strong>Декларация 3-НДФЛ</strong> и{" "}
              <strong>Заявление на налоговый вычет</strong>.
            </p>
            <p>
              Вы можете подать их в Налоговую самостоятельно либо доверить подачу
              документов нам. Оплата наших услуг производится после готовности и
              проверки вами документов. В случае возвращения документов Налоговой
              с замечаниями по нашей вине мы бесплатно выполняем все
              корректировки, а в случае невозможности исправления — возвращаем
              деньги в полном объёме, что гарантировано{" "}
              <Link to="/publichnaya-oferta">Договором</Link>.
            </p>
          </div>

          <div className="up-field">
            <div className="up-field__head">
              <span className="up-field__label">Подача документов в Налоговую</span>
            </div>
            <Seg
              name="Подача документов"
              value={sendMode}
              onChange={setSendMode}
              options={[
                { value: "self", label: "Отправлю в Налоговую сам" },
                { value: "us", label: "Отправьте за меня" },
              ]}
            />
            {sendMode === "us" && (
              <div style={{ marginTop: 14 }}>
                <Seg
                  name="Способ отправки"
                  value={sendMethod}
                  onChange={setSendMethod}
                  options={[
                    { value: "paper", label: "Отправить в Налоговую на бумажном носителе" },
                    { value: "cabinet", label: "Отправить через мой личный кабинет Налоговой" },
                  ]}
                />
                {sendMethod === "cabinet" &&
                  credsBlock(sendLogin, setSendLogin, sendPassword, setSendPassword, true)}
                <div className="form__field" style={{ marginTop: 16 }}>
                  <label htmlFor="reg-address">Адрес регистрации</label>
                  <input
                    id="reg-address"
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Индекс, город, улица, дом, квартира"
                  />
                  <p className="creds__note" style={{ marginTop: 6 }}>
                    Необходим для определения Налоговой, в которую подаются документы
                  </p>
                </div>
              </div>
            )}
          </div>

          {notice && (
            <p className="doc-note doc-note--ok" role="status">
              ✓ {notice}
            </p>
          )}
          {error && (
            <p className="doc-note doc-note--err" role="alert">
              {error}
            </p>
          )}

          <div className="doc-actions">
            <button
              type="button"
              className="btn btn--ghost btn--lg"
              onClick={handleSaveDraft}
              disabled={savingDraft || submitting}
            >
              {savingDraft ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={handleSubmit}
              disabled={savingDraft || submitting}
            >
              {submitting ? "Отправляем…" : "Подготовить документы"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
