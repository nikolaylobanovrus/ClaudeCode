// Шаг 8: генерация и выдача документов. Генераторы (pdf-lib + шрифты)
// подгружаются лениво только здесь — в основной бандл сайта не входят.
// Доступ строго по оплаченному заказу: статус перепроверяется в базе.
import { useEffect, useMemo, useState } from "react";
import { useWizard } from "../WizardContext.jsx";
import { fetchOrderStatus } from "../../lib/payments.js";
import { computeDraftHash, findPurchase } from "../../lib/draftHash.js";
import { downloadBlob, toFile, canShareFiles, shareFiles, mailtoHref } from "../../lib/share.js";

const PDF_MIME = "application/pdf";

export default function StepDocuments({ onUnpaid }) {
  const { draft, dispatch } = useWizard();
  const [docs, setDocs] = useState(null); // [{key,title,note,filename,bytes,mime,beta}]
  // denied — оплаты нет; changed — анкета изменилась после оплаты
  const [state, setState] = useState("checking"); // checking | building | ready | denied | changed | error
  const [shareOk, setShareOk] = useState(null);

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
        const [{ buildDeclarationModel }, { buildDeclarationPdf }, { buildRefundApplicationPdf }, { buildDeclarationXml }] =
          await Promise.all([
            import("../../lib/ndfl/model.js"),
            import("../../lib/ndfl/pdf3ndfl.js"),
            import("../../lib/ndfl/zayavlenie.js"),
            import("../../lib/ndfl/xml3ndfl.js"),
          ]);
        const model = buildDeclarationModel(source);
        const [declPdf, appPdf] = await Promise.all([
          buildDeclarationPdf(model),
          buildRefundApplicationPdf(model),
        ]);
        const xml = buildDeclarationXml(model);
        if (!alive) return;
        setDocs([
          {
            key: "decl",
            title: `Декларация 3-НДФЛ за ${source.year} год`,
            note:
              "Напечатана на официальном бланке ФНС за выбранный год — как из программы налоговой. Заявление о возврате уже внутри (Приложение к Разделу 1).",
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
          {
            key: "app",
            title: "Заявление на возврат налога",
            note: "Понадобится, если налоговая попросит отдельное заявление после проверки декларации.",
            filename: `Заявление на возврат ${source.year}.pdf`,
            bytes: appPdf,
            mime: PDF_MIME,
          },
        ]);
        setState("ready");
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
  }, []);

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
        <button type="button" className="btn btn--primary" onClick={onUnpaid}>
          Оплатить новую декларацию
        </button>
      </div>
    );
  if (state === "building")
    return <p className="wiz__note">Формируем документы — несколько секунд…</p>;
  if (state === "error")
    return (
      <div className="doc-note doc-note--err">
        Не получилось сформировать документы. Обновите страницу и попробуйте ещё
        раз — черновик сохранён. Если не поможет, напишите нам в Telegram.
      </div>
    );

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
        <li>Войдите в Личный кабинет ФНС (lkfl2.nalog.ru) через Госуслуги.</li>
        <li>
          «Декларации» → «Подать декларацию» → «Загрузить готовую декларацию» —
          приложите XML-файл. Если файл не примется — заполните по цифрам из PDF,
          это 10 минут.
        </li>
        <li>Прикрепите подтверждающие документы (договоры, справки, чеки).</li>
        <li>Подпишите неквалифицированной ЭП (создаётся там же) и отправьте.</li>
        <li>Возврат придёт на ваш счёт после камеральной проверки — до 3 месяцев.</li>
      </ol>

      <div className="doc-actions" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => dispatch({ type: "RESET_KEEP_PERSONAL" })}
        >
          Заполнить ещё одну декларацию — за другой год или с новыми данными
        </button>
      </div>
      <p className="wiz__note">
        Каждая декларация оплачивается отдельно. Ваши личные данные и счёт
        сохранятся, анкета начнётся заново.
      </p>
    </div>
  );
}
