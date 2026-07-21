// Блок «Заполнить из документов» на шаге «О вас»: клиент загружает фото/PDF
// (справка о доходах, паспорт, договоры…), Claude распознаёт их и заполняет
// пустые поля анкеты. Ручной ввод пользователя НИКОГДА не затирается.
//
// Киллсвитч: блок показывается только при включённом серверном флаге
// doc_autofill (fail-closed: флаг выключен или база недоступна → блока нет,
// анкета работает как обычно). Отключение — docs/anthropic-setup.md.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWizard } from "./WizardContext.jsx";
import { useFeatureFlag } from "../lib/featureFlags.js";
import { parseDocuments, mergePatch, DocParseError, MAX_FILES } from "../lib/docParse.js";
import { ymGoal } from "../lib/metrika.js";

const ACCEPT = "image/*,.pdf,.heic,.heif";

export default function DocAutofill() {
  const { draft, dispatch } = useWizard();
  const enabled = useFeatureFlag("doc_autofill");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(null); // string[] — что подставили
  const [warnings, setWarnings] = useState([]);
  const alive = useRef(true);
  const opened = useRef(false); // цель autofill_open — один раз за визит

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (!enabled) return null;

  const addFiles = (list) => {
    setError("");
    // Копируем FileList сразу: onChange очищает input.value, и живой FileList
    // опустеет раньше, чем React выполнит функцию-обновитель состояния.
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
  };

  const recognize = async () => {
    setBusy(true);
    setError("");
    setApplied(null);
    setWarnings([]);
    ymGoal("autofill_try", { files: files.length });
    try {
      const { patch, warnings: w } = await parseDocuments(files, {
        year: draft.year,
        types: draft.types,
      });
      if (!alive.current) return;
      const { draftPatch, applied: done } = mergePatch(draft, patch);
      if (Object.keys(draftPatch).length)
        dispatch({ type: "APPLY_PATCH", patch: draftPatch });
      setApplied(done);
      setWarnings(w || []);
      setFiles([]);
      if (done.length) ymGoal("wizard_autofill", { fields: done.length });
      // Распознали, но подставить нечего (в документах нет данных для пустых
      // полей) — для воронки это тоже неудача, фиксируем причину.
      else ymGoal("autofill_fail", { reason: "empty_patch" });
    } catch (e) {
      if (!alive.current) return;
      const reason = e instanceof DocParseError ? e.message : "unknown";
      ymGoal("autofill_fail", { reason: reason.slice(0, 80) });
      setError(
        e instanceof DocParseError
          ? e.message
          : "Не получилось распознать документы — заполните поля вручную."
      );
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="autofill card">
      <button
        type="button"
        className="autofill__head"
        onClick={() =>
          setOpen((v) => {
            if (!v && !opened.current) {
              opened.current = true;
              ymGoal("autofill_open");
            }
            return !v;
          })
        }
        aria-expanded={open}
      >
        <span className="autofill__title">
          📷 Загрузите документы — заполним анкету за вас
        </span>
        <span className="autofill__chev">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="autofill__body">
          <p className="autofill__hint">
            Подойдут фото или PDF: справка о доходах (2-НДФЛ), паспорт, договор
            на жильё, справка банка о процентах, справки об оплате лечения или
            обучения. Распознанные значения подставятся только в пустые поля —
            введённое вами не изменится.
          </p>

          <div className="autofill__pickers">
            <label className="up-drop">
              <input
                type="file"
                multiple
                accept={ACCEPT}
                disabled={busy}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="up-drop__btn">📎 Выбрать файлы</span>
              <span className="up-drop__hint">фото, скан или PDF — лучше по 3–5 за раз, так быстрее</span>
            </label>
            {/* capture открывает камеру сразу, минуя галерею. Камера отдаёт
                по одному снимку — addFiles дописывает, можно снимать подряд.
                На десктопе кнопка скрыта CSS-ом (capture там игнорируется). */}
            <label className="up-drop autofill__shoot">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="up-drop__btn">📷 Сфотографировать</span>
              <span className="up-drop__hint">по одному документу, можно несколько подряд</span>
            </label>
          </div>

          {files.length > 0 && (
            <ul className="up-files">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Удалить ${f.name}`}
                    disabled={busy}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length > 0 && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={recognize}
            >
              {busy ? "Распознаём… 20–60 секунд (дольше, если файлов много)" : "Распознать и заполнить"}
            </button>
          )}

          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}

          {applied && (
            <div className={"doc-note " + (applied.length ? "doc-note--ok" : "doc-note--err")}>
              {applied.length ? (
                <>
                  Заполнили: {applied.join(", ")}. Проверьте значения по
                  документам — поля можно поправить вручную.
                </>
              ) : (
                <>В документах не нашлось данных для пустых полей анкеты.</>
              )}
              {warnings.length > 0 && (
                <ul className="autofill__warnings">
                  {warnings.map((w, i) => (
                    <li key={i}>⚠ {w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="autofill__privacy">
            🔒 Файлы передаются по защищённому каналу на сервер распознавания и
            нигде не сохраняются. Нажимая «Распознать и заполнить», вы даёте
            согласие на обработку загруженных документов (
            <Link to="/politika-konfidencialnosti">Политика конфиденциальности</Link>
            ). Не хотите загружать документы — просто заполните поля вручную,
            тогда данные не покинут ваш браузер.
          </p>
        </div>
      )}
    </div>
  );
}
