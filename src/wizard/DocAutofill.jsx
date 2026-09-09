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
import { hasSale, saleKindOf } from "../data/wizard.js";
import { useFeatureFlag } from "../lib/featureFlags.js";
import { parseDocuments, mergePatch, DocParseError, MAX_FILES } from "../lib/docParse.js";
import { ymGoal } from "../lib/metrika.js";

const ACCEPT = "image/*,.pdf,.heic,.heif";

// stepKey — шаг, на котором стоит блок («income» или «sale»). В комбинированной
// декларации есть оба, и просить надо разное: на «Продаже» — договор, на
// «Доходах» — справку о доходах и чеки. Раньше признак брался из черновика, но
// теперь наличие продажи больше не означает, что человек стоит на её шаге.
export default function DocAutofill({ stepKey = "income" }) {
  const { draft, dispatch } = useWizard();
  const sale = hasSale(draft) && stepKey === "sale";
  const saleRealty = sale && saleKindOf(draft) === "realty";
  const enabled = useFeatureFlag("doc_autofill");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(null); // string[] — что подставили
  // Почему подставить было нечего: { busy, skipped }. Нужен, чтобы не писать
  // «в документах не нашлось данных», когда данные как раз нашлись, но поля
  // уже заполнены человеком или реквизит не сошёлся по контрольной сумме.
  const [outcome, setOutcome] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [dropped, setDropped] = useState(0); // сколько файлов не влезло в лимит
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
    setFiles((prev) => {
      const all = [...prev, ...picked];
      setDropped(Math.max(0, all.length - MAX_FILES));
      return all.slice(0, MAX_FILES);
    });
  };

  const recognize = async () => {
    setBusy(true);
    setError("");
    setApplied(null);
    setOutcome(null);
    setWarnings([]);
    ymGoal("autofill_try", { files: files.length });
    try {
      const { patch, warnings: w, noDataReason } = await parseDocuments(files, {
        year: draft.year,
        types: draft.types,
      });
      if (!alive.current) return;
      // busyFields, а не busy: busy — это состояние «идёт распознавание».
      const { draftPatch, applied: done, skipped, busy: busyFields } = mergePatch(draft, patch);
      setOutcome({ busy: busyFields, skipped: skipped.length });
      if (Object.keys(draftPatch).length)
        dispatch({ type: "APPLY_PATCH", patch: draftPatch });
      setApplied(done);
      // Реквизиты, не прошедшие проверку, честно называем: пустое поле
      // заметно, а правдоподобно неверный ИНН человек пропустит.
      setWarnings([
        ...(w || []),
        ...(skipped?.length
          ? [`Не удалось уверенно прочитать: ${skipped.join(", ")} — впишите вручную`]
          : []),
      ]);
      setFiles([]);
      setDropped(0);
      if (done.length) ymGoal("wizard_autofill", { fields: done.length });
      // Распознали, но подставить нечего. Для воронки это неудача, но причины
      // две и лечатся по-разному:
      //   found=none  — модель не прочитала ни одной секции (плохое фото, не
      //                 тот документ, скан вверх ногами);
      //   found=…, busy>0 — прочитала, но эти поля человек уже заполнил сам,
      //                 то есть по сути ложная тревога.
      // Прежний параметр sections был бесполезен: модель всегда возвращает
      // ВСЕ секции схемы, просто с found:false, поэтому список ключей был
      // одинаковым в обоих случаях. Считаем именно found:true.
      else
        ymGoal("autofill_fail", {
          reason: "empty_patch",
          // Секции приходят двух видов: объект с полями (паспорт, счёт) и
          // массив записей (доходы) — «нашли» значит, что есть хоть одно
          // непустое поле. На флаг found не смотрим: модель ставит его
          // неаккуратно, а нам важно, было ли что подставлять.
          found:
            Object.entries(patch || {})
              .filter(([, v]) =>
                Array.isArray(v)
                  ? v.length > 0
                  : v &&
                    typeof v === "object" &&
                    Object.entries(v).some(
                      ([f, x]) => f !== "found" && x !== null && String(x ?? "").trim() !== ""
                    )
              )
              .map(([k]) => k)
              .join("|") || "none",
          // Прочитано, но поле уже заполнено человеком (ложная тревога).
          busy: busyFields,
          // Прочитано, но не прошло контрольную сумму (ИНН, ОКТМО, КПП).
          skipped: skipped.length,
          // Почему модель ничего не нашла — её собственный код из закрытого
          // списка (unreadable / wrong_year / not_a_document / no_such_data).
          // Текст предупреждений в аналитику не уходит: там бывают ФИО и
          // названия организаций.
          why: noDataReason || "none",
        });
    } catch (e) {
      if (!alive.current) return;
      // Код первым словом — чтобы в Метрике группировать причины (network,
      // timeout, http_504…), а не разбирать русские тексты.
      const reason =
        e instanceof DocParseError ? `${e.code}: ${e.message}` : "unknown";
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
          📷 {sale ? "Загрузите договор — заполним данные о продаже" : "Загрузите документы — заполним анкету за вас"}
        </span>
        <span className="autofill__chev">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="autofill__body">
          <p className="autofill__hint">
            {sale ? (
              <>
                Подойдёт фото или PDF договора купли-продажи
                {saleRealty ? " недвижимости и выписки ЕГРН" : " автомобиля"} (и
                договора покупки, если заявляете расходы). Распознаем
                {saleRealty ? " цену, кадастровый номер, даты" : " цену, дату"} и
                покупателя и подставим только в пустые поля — введённое вами не
                изменится.
              </>
            ) : (
              <>
                Подойдут фото или PDF: справка о доходах (2-НДФЛ), паспорт,
                договор на жильё, справка банка о процентах, справки об оплате
                лечения или обучения. Распознанные значения подставятся только в
                пустые поля — введённое вами не изменится.
              </>
            )}
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

          {dropped > 0 && (
            <p className="wiz__note" role="status">
              Загружены первые {MAX_FILES} файлов — остальные ({dropped})
              добавьте вторым заходом после распознавания.
            </p>
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
            <div
              className={
                "doc-note " +
                (applied.length || outcome?.busy ? "doc-note--ok" : "doc-note--err")
              }
            >
              {applied.length ? (
                <>
                  Заполнили: {applied.join(", ")}. Проверьте значения по
                  документам — поля можно поправить вручную.
                </>
              ) : outcome?.busy ? (
                /* Данные прочитаны, но все эти поля человек уже заполнил сам.
                   Раньше здесь висело красное «в документах не нашлось
                   данных» — человек считал, что распознавание сломалось. */
                <>Всё, что нашлось в документах, у вас уже заполнено — менять нечего.</>
              ) : outcome?.skipped ? (
                <>
                  Данные в документах нашлись, но реквизиты не сошлись по
                  контрольной сумме — впишите их вручную.
                </>
              ) : (
                <>
                  В документах не нашлось данных для пустых полей анкеты.
                  Проверьте, что снимок не смазан и виден целиком, а документы
                  — за {draft.year} год.
                </>
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
