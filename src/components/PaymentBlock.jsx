import { useState } from "react";
import { getAccount, updateAccount } from "../lib/account.js";
import { company } from "../data/content.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU") + " ₽";

// Блок оплаты с ФИКСИРОВАННОЙ суммой, назначенной оператором.
// tariffName и amount приходят из базы (через GatedPayment).
export default function PaymentBlock({ title = "Оплата услуг", tariffName = "", amount = 0 }) {
  const account = getAccount();
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(account?.paymentStatus === "reported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  if (!account) return null;

  const pay = company.payment;
  const comment = `ID ${account.id}`;
  const priceStr = fmt(amount);
  const amountDigits = String(amount || 0);
  const payUrl = pay.link
    ? pay.link + (pay.link.includes("?") ? "&" : "?") + "amount=" + amountDigits
    : "";

  function openPayment() {
    if (payUrl) window.open(payUrl, "_blank", "noopener");
    setOpen(true);
  }

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* буфер недоступен — текст виден рядом */
    }
  }

  async function reportPaid() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `Клиент сообщил об оплате — ID ${account.id}`,
          _template: "table",
          _captcha: "false",
          "ID клиента": String(account.id),
          "Email": account.email,
          "Тариф": tariffName || "—",
          "Сумма": priceStr,
          "Способ оплаты": `${pay.method} → ${pay.bank}, ${pay.phone}`,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      updateAccount({ paymentStatus: "reported" });
      setReported(true);
    } catch {
      setError("Не удалось отправить подтверждение. Попробуйте ещё раз или позвоните нам.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pay">
      <h3 className="pay__title">{title}</h3>
      <p className="pay__note">
        Документы подготовлены и направлены вам на email. Проверьте их,
        пожалуйста, и можно оплачивать. В случае если Налоговая вернёт заявление
        по нашей ошибке — мы бесплатно всё исправим либо вернём оплату в полном
        объёме.
      </p>

      <div className="pay__amount">
        {tariffName && <span className="pay__tariff-name">{tariffName}</span>}
        К оплате: <strong>{priceStr}</strong>
      </div>

      {reported ? (
        <div className="doc-note doc-note--ok" role="status">
          ✓ Спасибо! Вы сообщили об оплате на сумму {priceStr}. Мы проверим
          поступление и подтвердим по почте.
        </div>
      ) : (
        <>
          <button type="button" className="btn btn--green btn--lg" onClick={openPayment}>
            Оплатить {priceStr}
          </button>

          {open && (
            <div className="pay__panel">
              {payUrl && (
                <>
                  <p className="pay__step">
                    Страница оплаты Т-Банка открылась в новой вкладке. Если этого
                    не произошло — нажмите кнопку:
                  </p>
                  <a className="btn btn--primary" href={payUrl} target="_blank" rel="noreferrer">
                    Оплатить {priceStr} через Т-Банк
                  </a>
                  <p className="pay__hint">
                    В комментарии к платежу укажите <strong>{comment}</strong> —
                    так мы быстрее найдём ваш платёж.
                    <button
                      type="button"
                      className="pay__copy"
                      style={{ marginLeft: 8 }}
                      onClick={() => copy(comment, "comment2")}
                    >
                      {copied === "comment2" ? "✓ Скопировано" : "Копировать ID"}
                    </button>
                  </p>
                </>
              )}

              <details className="pay__alt" open={!payUrl}>
                <summary>
                  {payUrl
                    ? "Другой способ: СБП-перевод по номеру телефона"
                    : "СБП-перевод по номеру телефона"}
                </summary>
                <p className="pay__step" style={{ marginTop: 12 }}>
                  Переведите <strong>{priceStr}</strong> через <strong>СБП</strong>{" "}
                  (Систему быстрых платежей):
                </p>
                <ul className="pay__req">
                  <li>
                    <span>Номер телефона</span>
                    <span className="pay__val">
                      {pay.phone}
                      <button type="button" className="pay__copy" onClick={() => copy(pay.phone, "phone")}>
                        {copied === "phone" ? "✓ Скопировано" : "Копировать"}
                      </button>
                    </span>
                  </li>
                  <li>
                    <span>Банк получателя</span>
                    <span className="pay__val">{pay.bank}</span>
                  </li>
                  <li>
                    <span>Получатель</span>
                    <span className="pay__val">{pay.recipient}</span>
                  </li>
                  <li>
                    <span>Сумма</span>
                    <span className="pay__val">
                      {priceStr}
                      <button type="button" className="pay__copy" onClick={() => copy(amountDigits, "sum")}>
                        {copied === "sum" ? "✓ Скопировано" : "Копировать"}
                      </button>
                    </span>
                  </li>
                  <li>
                    <span>Комментарий к переводу</span>
                    <span className="pay__val">
                      {comment}
                      <button type="button" className="pay__copy" onClick={() => copy(comment, "comment")}>
                        {copied === "comment" ? "✓ Скопировано" : "Копировать"}
                      </button>
                    </span>
                  </li>
                </ul>
                <p className="pay__hint">
                  Откройте приложение вашего банка → «Платежи» → «Перевод по
                  номеру телефона» → выберите банк <strong>{pay.bank}</strong>.
                  Обязательно укажите комментарий <strong>{comment}</strong> — так
                  мы быстрее найдём ваш платёж.
                </p>
              </details>

              <button type="button" className="btn btn--ghost" onClick={reportPaid} disabled={busy}>
                {busy ? "Отправляем…" : "Я оплатил(а)"}
              </button>
              {error && (
                <span className="form__error" role="alert">
                  {error}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
