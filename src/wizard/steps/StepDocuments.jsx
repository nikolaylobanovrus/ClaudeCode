// Шаг 8: генерация и выдача документов. Генераторы (pdf-lib + шрифты)
// подгружаются лениво только здесь — в основной бандл сайта не входят.
// Доступ строго по оплаченному заказу: статус перепроверяется в базе.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWizard } from "../WizardContext.jsx";
import { company } from "../../data/content.js";
import { hasSale, hasRefund, modeOf } from "../../data/wizard.js";
import { YEARS, refundDeadlineYear } from "../../lib/ndfl/refs.js";
import { fetchOrderStatus } from "../../lib/payments.js";
import { computeDraftHash, draftSnapshot, findPurchase } from "../../lib/draftHash.js";
import { downloadBlob, toFile, canShareFiles, shareFiles, mailtoHref } from "../../lib/share.js";
import { ymGoal } from "../../lib/metrika.js";

const PDF_MIME = "application/pdf";

export default function StepDocuments({ onUnpaid }) {
  const { draft, dispatch } = useWizard();
  const [docs, setDocs] = useState(null); // [{key,title,note,filename,bytes,mime,beta}]
  // denied — оплаты нет; changed — анкета изменилась после оплаты
  const [state, setState] = useState("checking"); // checking | building | ready | denied | changed | error
  const [shareOk, setShareOk] = useState(null);
  // Счётчик попыток: восстановление доступа по номеру заказа перезапускает
  // ту же проверку, что и при обычном заходе на шаг.
  const [attempt, setAttempt] = useState(0);

  // File-объекты создаются один раз: new File копирует мегабайтные буферы,
  // пересоздавать их на каждый рендер (и дёргать canShare) расточительно.
  const files = useMemo(
    () => (docs ? docs.map((d) => toFile(d.bytes, d.filename, d.mime)) : []),
    [docs]
  );
  const shareSupported = useMemo(
    () => files.length > 0 && canShareFiles(files),
    [files]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      // 1. Покупка для ТЕКУЩЕГО состояния анкеты: оплата привязана к данным
      // (draftHash). Изменение года или полей после оплаты = другая
      // декларация = отдельная оплата.
      const hash = await computeDraftHash(draft);
      if (!alive) return;
      const purchase = findPurchase(draft, hash);
      if (!purchase) {
        setState((draft.purchases || []).length ? "changed" : "denied");
        return;
      }
      // 2. Серверная проверка оплаты (localStorage не доверяем).
      try {
        const status = await fetchOrderStatus(purchase);
        if (!alive) return;
        if (status !== "paid") {
          setState("denied");
          return;
        }
      } catch {
        if (!alive) return;
        setState("denied");
        return;
      }
      // 3. Генерация всех трёх документов в браузере — из СНИМКА данных,
      // за которые заплачено (совпадает с текущей анкетой по хешу).
      const source = purchase.snapshot || draft;
      setState("building");
      try {
        const [{ buildDeclarationModel }, { buildDeclarationPdf }, { buildRefundApplicationPdf }, { buildDeclarationXml }, { buildInstructionPdf }] =
          await Promise.all([
            import("../../lib/ndfl/model.js"),
            import("../../lib/ndfl/pdf3ndfl.js"),
            import("../../lib/ndfl/zayavlenie.js"),
            import("../../lib/ndfl/xml3ndfl.js"),
            import("../../lib/ndfl/instrukciya.js"),
          ]);
        const model = buildDeclarationModel(source);
        const mode = modeOf(source);
        const sale = mode === "sale"; // чистая продажа: возвращать нечего
        // Продажа: налог к уплате — заявления о возврате нет. В комбинированной
        // декларации возврат есть, значит есть и заявление.
        const [declPdf, appPdf, instrPdf] = await Promise.all([
          buildDeclarationPdf(model),
          sale ? Promise.resolve(null) : buildRefundApplicationPdf(model),
          buildInstructionPdf({ year: source.year, types: source.types }),
        ]);
        const xml = buildDeclarationXml(model);
        if (!alive) return;
        setDocs([
          {
            key: "decl",
            title:
              `Декларация 3-НДФЛ за ${source.year} год` +
              (Number(source.correction) > 0
                ? ` (уточнённая, корректировка № ${source.correction})`
                : ""),
            note:
              mode === "sale"
                ? "Напечатана на официальном бланке ФНС. Внутри — Приложение 6 (расчёт по продаже) и налог к уплате в Разделах 1 и 2."
                : mode === "mixed"
                  ? "Напечатана на официальном бланке ФНС. Внутри и продажа (Приложение 6, налог к уплате), и вычеты (заявление о возврате — в Приложении к Разделу 1). Это одна декларация за год, как и требует налоговая."
                  : "Напечатана на официальном бланке ФНС за выбранный год — как из программы налоговой. Заявление о возврате уже внутри (Приложение к Разделу 1).",
            filename: `Декларация 3-НДФЛ ${source.year}.pdf`,
            bytes: declPdf,
            mime: PDF_MIME,
          },
          {
            key: "xml",
            title: "Файл для Личного кабинета ФНС",
            note:
              "Загрузите на сайте ФНС: Декларации → Подать декларацию → Загрузить готовую декларацию. " +
              "Файл проверен по официальной XSD-схеме ФНС за выбранный год.",
            filename: xml.filename,
            bytes: xml.bytes,
            mime: "application/xml",
          },
          // Заявление на возврат — только для возвратной декларации.
          appPdf && {
            key: "app",
            title: "Заявление на возврат налога",
            note: "Понадобится, если налоговая попросит отдельное заявление после проверки декларации.",
            filename: `Заявление на возврат ${source.year}.pdf`,
            bytes: appPdf,
            mime: PDF_MIME,
          },
          {
            key: "instr",
            title: "Инструкция по подаче (PDF)",
            note:
              "Три способа подачи шаг за шагом — ЛК ФНС, почтой, лично — и список подтверждающих документов. Можно распечатать или переслать.",
            filename: `Как подать 3-НДФЛ ${source.year}.pdf`,
            bytes: instrPdf,
            mime: PDF_MIME,
          },
        ].filter(Boolean));
        setState("ready");
        // Без этой цели мы не знаем, дошли ли документы до оплатившего
        // человека: статус «paid» в базе стоит и тогда, когда он их так и
        // не увидел (ровно это случилось 18.08 при переезде хостинга).
        ymGoal("docs_ready", { year: source.year });
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setState("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state === "checking")
    return <p className="wiz__note">Проверяем оплату…</p>;
  if (state === "denied")
    return (
      <div>
        <div className="doc-note doc-note--err">
          Не видим оплату по этому заказу. Вернитесь на шаг «Оплата» — после
          подтверждения документы откроются автоматически.
        </div>
        <button type="button" className="btn btn--ghost" onClick={onUnpaid}>
          ← К оплате
        </button>
        <RecoverByOrder draft={draft} dispatch={dispatch} onDone={() => setAttempt((a) => a + 1)} />
      </div>
    );
  if (state === "changed")
    return (
      <div>
        <div className="doc-note doc-note--err">
          Анкета изменилась после оплаты. Каждая декларация — за один год и на
          одного человека — оплачивается отдельно. Верните прежние данные, чтобы
          снова открыть оплаченные документы, или оплатите новую декларацию.
        </div>
        {/* Типовой сценарий правки после оплаты — исправление уже поданной
            декларации: подсказываем уточнёнку (номер корректировки на титуле). */}
        {!Number(draft.correction) && (
          <div className="doc-note doc-note--ok">
            Исправляете декларацию, которую уже <strong>подали</strong> в
            налоговую? Тогда нужна <strong>уточнённая</strong> — с номером
            корректировки на титульном листе.{" "}
            <button
              type="button"
              className="wiz__edit"
              onClick={() => {
                ymGoal("correction_on", { n: 1, where: "changed" });
                dispatch({ type: "SET", key: "correction", value: 1 });
              }}
            >
              Сделать уточнённой (корректировка № 1)
            </button>
          </div>
        )}
        <button type="button" className="btn btn--primary" onClick={onUnpaid}>
          Оплатить новую декларацию
        </button>
        <RecoverByOrder draft={draft} dispatch={dispatch} onDone={() => setAttempt((a) => a + 1)} />
      </div>
    );
  if (state === "building")
    return <p className="wiz__note">Формируем документы — несколько секунд…</p>;
  if (state === "error")
    return (
      <div className="doc-note doc-note--err">
        Не получилось сформировать документы. Обновите страницу и попробуйте ещё
        раз — черновик сохранён. Если не поможет,{" "}
        <a href={company.telegram} target="_blank" rel="noopener noreferrer">
          напишите нам в Telegram
        </a>{" "}
        или позвоните: <a href={`tel:${company.phoneRaw}`}>{company.phone}</a>.
      </div>
    );

  // Прошлые годы: налог за год X возвращают, подав декларацию не позднее
  // конца года X+3 (ст. 79 НК РФ) — годы с истёкшим сроком не предлагаем.
  // Год, за который только что сформировали комплект, исключаем.
  const filedYear = Number(draft.year);
  const thisYear = new Date().getFullYear();
  const pastYears = YEARS.filter(
    (y) => y !== filedYear && refundDeadlineYear(y) >= thisYear
  );
  const oldestYear = pastYears.length ? Math.min(...pastYears) : null;

  // Клиенты регулярно возвращаются за декларациями прошлых лет — предлагаем
  // сами, пока паспорт, ИНН и счёт под рукой (RESET_KEEP_PERSONAL их хранит).
  const startYear = (y) => {
    ymGoal("another_year", { year: y });
    dispatch({ type: "RESET_KEEP_PERSONAL" });
    dispatch({ type: "SET", key: "year", value: y });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const shareAll = async () => {
    const ok = await shareFiles({
      files,
      title: "Документы 3-НДФЛ",
      text: `Декларация 3-НДФЛ за ${draft.year} год`,
    });
    setShareOk(ok);
  };

  return (
    <div>
      <div className="doc-note doc-note--ok">
        Готово! Скачайте документы и подайте их через Личный кабинет ФНС.
      </div>

      <ul className="wiz__docs">
        {docs.map((d, i) => (
          <li className="wiz__doc card" key={d.key}>
            <div className="wiz__doc-info">
              <strong>
                {d.title}
                {d.beta && <span className="wiz__beta">бета</span>}
              </strong>
              <p>{d.note}</p>
            </div>
            <div className="doc-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => downloadBlob(d.bytes, d.filename, d.mime)}
              >
                Скачать
              </button>
              {shareSupported && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => shareFiles({ files: [files[i]], title: d.title })}
                >
                  Поделиться
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="doc-actions" style={{ marginTop: 14 }}>
        {shareSupported && (
          <button type="button" className="btn btn--green btn--lg" onClick={shareAll}>
            Отправить всё в мессенджер / почту
          </button>
        )}
        <a
          className="btn btn--ghost"
          href={mailtoHref(
            `Документы 3-НДФЛ за ${draft.year} год`,
            "Документы сформированы сервисом «Налог-сервис». Скачайте файлы на устройство и приложите их к этому письму."
          )}
        >
          Письмо себе на почту
        </a>
      </div>
      {shareOk === false && (
        <p className="wiz__note">
          Не получилось открыть меню «Поделиться» — скачайте файлы кнопками выше.
        </p>
      )}

      <h3 className="wiz__subhead">Что дальше</h3>
      <ol className="wiz__next">
        <li>
          Войдите в{" "}
          <a
            href="https://lkfl2.nalog.ru/lkfl/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => ymGoal("lk_fns", { where: "submit" })}
          >
            Личный кабинет ФНС
          </a>{" "}
          (lkfl2.nalog.ru) через Госуслуги.
        </li>
        <li>
          «Декларации» → «Подать декларацию» → «Загрузить готовую декларацию» —
          приложите XML-файл. Если файл не примется — заполните по цифрам из PDF,
          это 10 минут.
        </li>
        <li>Прикрепите подтверждающие документы (договоры, справки, чеки).</li>
        <li>Подпишите неквалифицированной ЭП (создаётся там же) и отправьте.</li>
        {hasSale(draft) && (
          <li>
            Заплатите начисленный налог до 15 июля {Number(draft.year) + 1} года —
            по реквизитам вашей инспекции или через ЛК ФНС.
          </li>
        )}
        {hasRefund(draft) && (
          <li>Возврат придёт на ваш счёт после камеральной проверки — до 3 месяцев.</li>
        )}
      </ol>
      <p className="wiz__note">
        Не хотите через интернет? Есть подача почтой и лично в ФНС/МФЦ —{" "}
        <Link to="/deklaraciya/instrukciya">подробная инструкция всех трёх способов</Link>{" "}
        (она же лежит PDF-файлом в вашем комплекте).
      </p>

      {pastYears.length > 0 && (
        <div className="wiz__again">
          <h3 className="wiz__subhead">А за прошлые годы вычет заявляли?</h3>
          <p>
            Вычет не сгорает сразу: налог возвращают за три последних года. Если
            в {pastYears.map((y, i) => (i ? `, ${y}` : String(y))).join("")} вы
            платили за лечение, лекарства, обучение, спорт или страхование,
            покупали жильё или платили проценты по ипотеке — за эти годы деньги
            тоже можно вернуть.
          </p>
          <div className="doc-actions">
            {pastYears.map((y) => (
              <button
                key={y}
                type="button"
                className="btn btn--primary"
                onClick={() => startYear(y)}
              >
                Декларация за {y} год
              </button>
            ))}
          </div>
          <p className="wiz__note">
            Паспорт, ИНН и реквизиты счёта уже сохранены — останется отметить
            вычеты и вписать суммы. Каждый год — отдельная декларация и отдельная
            оплата 199 ₽. Крайний срок по самому старому году: за {oldestYear}{" "}
            — до 31 декабря {refundDeadlineYear(oldestYear)} года.
          </p>
        </div>
      )}

      <div className="doc-actions" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => dispatch({ type: "RESET_KEEP_PERSONAL" })}
        >
          Заполнить ещё одну декларацию — с новыми данными
        </button>
      </div>
      <p className="wiz__note">
        Каждая декларация оплачивается отдельно. Ваши личные данные и счёт
        сохранятся, анкета начнётся заново.
      </p>
    </div>
  );
}

// Восстановление доступа по номеру заказа.
//
// Оплаченные комплекты живут в localStorage браузера: очистил данные, сменил
// устройство или не смог вернуться на сайт после оплаты — и человек, который
// заплатил, документов не получит. 18.08.2026 так и вышло: клиент оплатил в
// 17:34, а сайт в этот момент был недоступен у его провайдера (переезжали с
// GitHub Pages), возврат с ЮKassa не открылся.
//
// Номер заказа приходит человеку в адресной строке при возврате с оплаты
// (?order=…) и знает его только плательщик — этого достаточно, чтобы по нему
// разблокировать выдачу: статус всё равно перепроверяется в базе.
function RecoverByOrder({ draft, dispatch, onDone }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const orderId = id.trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId)) {
      setError("Номер заказа выглядит не так — это длинный код из адресной строки после «?order=».");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const status = await fetchOrderStatus({ id: orderId, provider: "yookassa" });
      if (status !== "paid") {
        setError("По этому номеру оплата не подтверждена. Проверьте номер или напишите нам — разберёмся вручную.");
        return;
      }
      // Привязываем оплату к ТЕКУЩЕЙ анкете: снимок нужен, чтобы документы
      // потом собрались ровно из этих данных, даже если человек продолжит
      // править поля.
      const hash = await computeDraftHash(draft);
      dispatch({
        type: "ADD_PURCHASE",
        purchase: {
          id: orderId,
          provider: "yookassa",
          amount: 199,
          paidAt: new Date().toISOString(),
          draftHash: hash,
          snapshot: draftSnapshot(draft),
        },
      });
      ymGoal("order_recovered");
      onDone();
    } catch {
      setError("Не получилось проверить оплату — попробуйте ещё раз или напишите нам.");
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <p className="wiz__note" style={{ marginTop: 14 }}>
        Оплатили, а документы не открылись?{" "}
        <button type="button" className="wiz__edit" onClick={() => setOpen(true)}>
          Восстановить доступ по номеру заказа
        </button>
      </p>
    );

  return (
    <form className="wiz__recover" onSubmit={submit}>
      <label htmlFor="recover-order">Номер заказа</label>
      <p className="wiz__note">
        Он был в адресной строке сразу после оплаты — длинный код после
        «?order=». Ещё его видно в письме или SMS от ЮKassa.
      </p>
      <div className="wiz__recover-row">
        <input
          id="recover-order"
          type="text"
          autoComplete="off"
          spellCheck="false"
          placeholder="00000000-0000-0000-0000-000000000000"
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Проверяем…" : "Открыть документы"}
        </button>
      </div>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <p className="wiz__note">
        Важно: документы соберутся из того, что сейчас в анкете. Если данные
        пришлось вводить заново — сверьте их перед скачиванием.
      </p>
    </form>
  );
}
