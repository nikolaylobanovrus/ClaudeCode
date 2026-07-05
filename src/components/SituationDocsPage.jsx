import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "./Seo.jsx";
import PageHero from "./PageHero.jsx";
import { getAccount, updateAccount, isLoggedIn } from "../lib/account.js";
import { sbUploadClientFile } from "../lib/supabase.js";
import GatedPayment from "./GatedPayment.jsx";

// Письмо оператору — ТОЛЬКО текстовое (AJAX-эндпоинт): доставка проверена.
// Файлы почтой не отправляем — письма с вложениями терялись молча; вместо
// этого файлы уходят в защищённое хранилище (см. uploadAllFiles).
const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";
// Ограничение на суммарный размер файлов одной отправки.
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.heic,.heif";

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

// Общая страница «загрузка документов по ситуации». Всё различие между
// ситуациями — в config:
//   slug        — часть URL (/situaciya/<slug>) и ключа черновика;
//   label       — название ситуации (кабинет клиента, хлебные крошки);
//   subject     — название в теме письма оператору;
//   title/subtitle/seoTitle/seoDescription — тексты шапки и SEO;
//   intro       — вводный абзац перед списком документов (JSX);
//   fileFields  — список полей загрузки: { key, label, hint, textInput };
//                 поле с key="ndfl" получает выбор «Получу сам / Получите за меня»;
//                 textInput: { placeholder } добавляет текстовое поле — клиент
//                 может вставить данные текстом вместо загрузки файла.
export default function SituationDocsPage({ config }) {
  const { slug, label, subject, fileFields } = config;
  const DRAFT_KEY = `ns.draft.${slug}.v1`;
  const PATH = `/situaciya/${slug}`;

  const navigate = useNavigate();
  const account = getAccount();

  const loadDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
    } catch {
      return null;
    }
  };
  const [draft] = useState(loadDraft);

  const [files, setFiles] = useState({});
  const [hints, setHints] = useState({});
  const [ndflMode, setNdflMode] = useState(draft?.ndflMode || "self");
  const [fnsLogin, setFnsLogin] = useState("");
  const [fnsPassword, setFnsPassword] = useState("");
  const [sendMode, setSendMode] = useState(draft?.sendMode || "self");
  const [sendMethod, setSendMethod] = useState(draft?.sendMethod || "paper");
  const [sendLogin, setSendLogin] = useState("");
  const [sendPassword, setSendPassword] = useState("");
  const [regAddress, setRegAddress] = useState(draft?.regAddress || "");
  const [draftFileNames, setDraftFileNames] = useState(draft?.fileNames || {});
  // Тексты полей с textInput (например, реквизиты счёта, вставленные текстом).
  const [fieldTexts, setFieldTexts] = useState(draft?.fieldTexts || {});

  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [failedFiles, setFailedFiles] = useState([]);

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

  // Файлы клиента загружаются в защищённое хранилище (Supabase Storage),
  // а письмо оператору уходит текстовым — почтовый сервис теряет вложения
  // (простые письма доставляются, письма с файлами «глотаются» молча).
  // Возвращает карту { ключПоля: { ok: [имена], failed: [имена] } }.
  async function uploadAllFiles() {
    const stamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")
      .replace(":", "-");
    const result = {};
    for (const f of fileFields) {
      const list = files[f.key] || [];
      if (!list.length) continue;
      const ok = [];
      const failed = [];
      for (const file of list) {
        try {
          ok.push(await sbUploadClientFile(account.id, file, stamp));
        } catch {
          failed.push(file.name);
        }
      }
      result[f.key] = { ok, failed };
    }
    return result;
  }

  function buildFormData(kind, uploads) {
    const fd = new FormData();
    fd.append(
      "_subject",
      `ID ${account.id} — ${subject}${kind === "draft" ? " Черновик" : ""}`
    );
    fd.append("_template", "table");
    fd.append("_captcha", "false");
    fd.append("ID клиента", String(account.id));
    fd.append("Email клиента", account.email);
    if (account.phone) fd.append("Телефон клиента", account.phone);

    fileFields.forEach((f) => {
      const up = uploads[f.key];
      const text = (fieldTexts[f.key] || "").trim();
      if (up?.ok?.length) {
        fd.append(
          f.label,
          `Файлы в кабинете оператора (клиент ${account.id}): ${up.ok.join("; ")}`
        );
      }
      if (up?.failed?.length) {
        fd.append(
          `${f.label} — НЕ ЗАГРУЗИЛИСЬ`,
          `${up.failed.join("; ")} — запросите у клиента в мессенджере`
        );
      }
      if (text) {
        fd.append(up?.ok?.length ? `${f.label} — текстом` : f.label, text);
      }
      if (!up?.ok?.length && !up?.failed?.length && !text) {
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

    if (fileFields.some((f) => f.key === "ndfl")) {
      fd.append(
        "Справка 2-НДФЛ — способ получения",
        ndflMode === "us" ? "Получите за меня" : "Получу сам"
      );
      if (ndflMode === "us") {
        fd.append("ФНС: Логин/ИНН", fnsLogin || "не указан");
        fd.append("ФНС: Пароль", fnsPassword || "не указан");
      }
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

  // Отправка: сначала файлы в хранилище, затем текстовое письмо оператору
  // (AJAX-эндпоинт с читаемым ответом — честное подтверждение доставки).
  // Возвращает список файлов, которые загрузить не удалось.
  async function send(kind) {
    const uploads = await uploadAllFiles();
    const fd = buildFormData(kind, uploads);
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json().catch(() => null);
    if (data && String(data.success) !== "true")
      throw new Error(data.message || "form rejected");
    return Object.values(uploads).flatMap((u) => u.failed || []);
  }

  function persistDraft() {
    const names = { ...draftFileNames };
    fileFields.forEach((f) => {
      const list = files[f.key] || [];
      if (list.length)
        names[f.key] = [...(names[f.key] || []), ...list.map((x) => x.name)];
    });
    // ВАЖНО: логины/пароли от кабинета Налоговой НЕ сохраняем в localStorage
    // (чувствительные данные). Они уже отправлены оператору письмом при
    // «Сохранить»; при возврате к черновику клиент вводит их заново.
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          fileNames: names,
          fieldTexts,
          ndflMode,
          sendMode,
          sendMethod,
          regAddress,
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      /* ignore */
    }
    setDraftFileNames(names);
    setFiles({});
  }

  async function handleSaveDraft() {
    setError("");
    setNotice("");
    if (totalSize() > MAX_TOTAL_BYTES) {
      setError("Файлы слишком большие (суммарно до 50 МБ за раз). Сохраните часть файлов, затем добавьте остальные.");
      return;
    }
    setSavingDraft(true);
    try {
      const failed = await send("draft");
      persistDraft();
      updateAccount({ situation: label, docsStatus: "draft" });
      setNotice(
        failed.length
          ? `Черновик отправлен, но часть файлов не загрузилась (${failed.join(", ")}). Добавьте их снова и сохраните ещё раз — или пришлите на почту nalog-service@internet.ru с вашим ID.`
          : "Черновик сохранён и отправлен нам. Заполненные данные сохранены — при следующем входе останется дозаполнить только пустые поля."
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
    const hasAnyText = Object.values(fieldTexts).some((t) => t && t.trim());
    const hasNdflField = fileFields.some((f) => f.key === "ndfl");
    if (!hasAnyFiles && !hasAnyText && !(hasNdflField && ndflMode === "us")) {
      setError(
        hasNdflField
          ? "Загрузите хотя бы один документ или выберите «Получите за меня» в справке 2-НДФЛ."
          : "Загрузите хотя бы один документ или заполните текстовое поле."
      );
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
    if (totalSize() > MAX_TOTAL_BYTES) {
      setError("Файлы слишком большие (суммарно до 50 МБ за раз). Сначала нажмите «Сохранить» с частью файлов, затем добавьте остальные и отправьте.");
      return;
    }
    setSubmitting(true);
    try {
      const failed = await send("final");
      setFailedFiles(failed);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      updateAccount({
        situation: label,
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
        <Seo
          title="Документы отправлены | Налог-сервис"
          description={`Документы по ситуации «${label}» отправлены.`}
          path={PATH}
          noindex
        />
        <PageHero eyebrow={`ID клиента: ${account.id}`} title="Документы отправлены!" crumbs={[label]} />
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
              {failedFiles.length > 0 && (
                <p className="doc-note doc-note--err" style={{ textAlign: "left" }}>
                  Не удалось загрузить: {failedFiles.join(", ")}. Пришлите эти
                  файлы нам на почту{" "}
                  <a href={`mailto:nalog-service@internet.ru?subject=ID ${account.id} — файлы к документам`}>
                    nalog-service@internet.ru
                  </a>{" "}
                  с указанием вашего ID {account.id} — остальные данные мы уже
                  получили.
                </p>
              )}
              <div className="cta__actions">
                <Link to="/kabinet" className="btn btn--primary">Личный кабинет</Link>
                <Link to="/" className="btn btn--ghost">На главную</Link>
              </div>
            </div>

            <div className="auth" style={{ marginTop: 24 }}>
              <GatedPayment title="Оплата услуг" />
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo
        title={config.seoTitle}
        description={config.seoDescription}
        path={PATH}
        noindex
      />
      <PageHero
        eyebrow={`ID клиента: ${account.id}`}
        title={label}
        subtitle={config.subtitle}
        crumbs={["Выберите ситуацию", label]}
      />

      <section className="section">
        <div className="container docpage">
          <p className="docpage__intro">{config.intro}</p>

          {fileFields.map((f) => {
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
                    {f.textInput && (
                      <div className="up-text">
                        <span className="up-text__or">или вставьте текстом</span>
                        <textarea
                          rows={3}
                          value={fieldTexts[f.key] || ""}
                          placeholder={f.textInput.placeholder || ""}
                          onChange={(e) =>
                            setFieldTexts((t) => ({ ...t, [f.key]: e.target.value }))
                          }
                        />
                      </div>
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
