import { useState } from "react";
import { getAccount, updateAccount } from "../lib/account.js";
import { company } from "../data/content.js";
import qrAlfa from "../assets/sbp-qr-alfa.png";
import qrSber from "../assets/sbp-qr-sber.png";
import { ymGoal } from "../lib/metrika.js";

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

  const pay = company.payment;
  const amountDigits = String(amount || 0);

  if (!account) return null;

  const comment = `ID ${account.id}`;
  const priceStr = fmt(amount);

  // Два «приложения банков»-варианта (QR + ссылка). Третий — перевод по номеру.
  const appOptions = [
    {
      key: "sber",
      num: 1,
      title: "Через приложения Сбербанк и Т-Банк",
      qr: qrSber,
      link: pay.linkSber,
      banks: pay.banksSber,
    },
    {
      key: "alfa",
      num: 2,
      title: "Через приложения Альфа-Банк, ВТБ, Газпромбанк, МТС Банк",
      qr: qrAlfa,
      link: pay.linkAlfa,
      banks: pay.banksAlfa,
    },
  ];

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
          "Способ оплаты": pay.method,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      updateAccount({ paymentStatus: "reported" });
      ymGoal("paid_reported", { amount });
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
          {!open && (
            <button type="button" className="btn btn--green btn--lg" onClick={() => setOpen(true)}>
              Оплатить {priceStr}
            </button>
          )}

          {open && (
            <div className="pay__panel">
              <p className="pay__lead">
                Выберите удобный способ оплаты на сумму{" "}
                <strong>{priceStr}</strong>. Оплата проходит через{" "}
                <strong>СБП</strong>.
              </p>

              <div className="payopts">
                {appOptions.map((o) => (
                  <div className="payopt" key={o.key}>
                    <div className="payopt__head">
                      <span className="payopt__num">{o.num}</span>
                      <span className="payopt__title">{o.title}</span>
                    </div>
                    <div className="payopt__body">
                      <div className="payopt__qr">
                        <img src={o.qr} alt={`QR-код СБП для оплаты (${o.banks.join(", ")})`} width="180" height="180" />
                      </div>
                      <div className="payopt__how">
                        <ol className="payopt__steps">
                          <li>
                            Отсканируйте QR камерой телефона или в приложении
                            банка (кнопка «Оплатить по QR»).
                          </li>
                          <li>
                            Проверьте получателя и укажите сумму{" "}
                            <strong>{priceStr}</strong>.
                          </li>
                        </ol>
                        <a className="btn btn--primary" href={o.link} target="_blank" rel="noreferrer">
                          Оплатить с телефона
                        </a>
                        <span className="payopt__mini">
                          Если оплачиваете с телефона — нажмите кнопку, QR не
                          нужен.
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Вариант 3 — перевод по номеру телефона (любой банк) */}
                <div className="payopt">
                  <div className="payopt__head">
                    <span className="payopt__num">3</span>
                    <span className="payopt__title">Перевод по СБП — с любого банка</span>
                  </div>
                  <div className="payopt__body payopt__body--phone">
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
                        <span>Получатель</span>
                        <span className="pay__val">{pay.recipient}</span>
                      </li>
                      <li>
                        <span>Банк получателя</span>
                        <span className="pay__val">{(pay.banksPhone || []).join(", ")}</span>
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
                    </ul>
                    <p className="payopt__mini">
                      Приложение банка → «Платежи» → «Перевод по номеру телефона»
                      → выберите получателя из списка и переведите{" "}
                      <strong>{priceStr}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <p className="pay__idnote">
                Необязательно, но желательно: в комментарии к платежу укажите{" "}
                <strong>{comment}</strong> — так мы найдём ваш платёж быстрее.
                <button type="button" className="pay__copy" onClick={() => copy(comment, "id")}>
                  {copied === "id" ? "✓ Скопировано" : "Копировать ID"}
                </button>
              </p>

              <div className="pay__done">
                <button type="button" className="btn btn--green" onClick={reportPaid} disabled={busy}>
                  {busy ? "Отправляем…" : "Я оплатил(а)"}
                </button>
                {error && (
                  <span className="form__error" role="alert">
                    {error}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
