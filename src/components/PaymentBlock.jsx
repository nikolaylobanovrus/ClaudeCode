import { useState } from "react";
import { getAccount, updateAccount } from "../lib/account.js";
import { company, tariffs } from "../data/content.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";

// Блок оплаты услуг: сумма из выбранного тарифа, приём — СБП-переводом
// на карту физлица в Т-Банке (реквизиты в company.payment).
export default function PaymentBlock({ title = "Оплата услуг" }) {
  const account = getAccount();
  const [tariffName, setTariffName] = useState(
    account?.tariff || "Оптимальный"
  );
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(
    account?.paymentStatus === "reported"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  if (!account) return null;

  const tariff = tariffs.find((t) => t.name === tariffName) || tariffs[1];
  const pay = company.payment;
  const comment = `ID ${account.id}`;

  function pick(name) {
    setTariffName(name);
    updateAccount({ tariff: name });
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
          "Тариф": tariff.name,
          "Сумма": tariff.price,
          "Способ оплаты": `${pay.method} → ${pay.bank}, ${pay.phone}`,
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      updateAccount({ paymentStatus: "reported", tariff: tariff.name });
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
      <p className="pay__note">Оплата после готовности документов.</p>

      <div className="pay__tariffs" role="radiogroup" aria-label="Тариф">
        {tariffs.map((t) => (
          <button
            key={t.name}
            type="button"
            role="radio"
            aria-checked={t.name === tariff.name}
            className={"seg__btn" + (t.name === tariff.name ? " is-active" : "")}
            onClick={() => pick(t.name)}
          >
            {t.name} · {t.price}
          </button>
        ))}
      </div>

      <div className="pay__amount">
        К оплате: <strong>{tariff.price}</strong>
      </div>

      {reported ? (
        <div className="doc-note doc-note--ok" role="status">
          ✓ Спасибо! Вы сообщили об оплате тарифа «{account.tariff || tariff.name}».
          Мы проверим поступление и подтвердим по почте.
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn btn--green btn--lg"
            onClick={() => setOpen((v) => !v)}
          >
            Оплатить
          </button>

          {open && (
            <div className="pay__panel">
              <p className="pay__step">
                Переведите <strong>{tariff.price}</strong> через{" "}
                <strong>СБП</strong> (Систему быстрых платежей):
              </p>
              <ul className="pay__req">
                <li>
                  <span>Номер телефона</span>
                  <span className="pay__val">
                    {pay.phone}
                    <button
                      type="button"
                      className="pay__copy"
                      onClick={() => copy(pay.phone, "phone")}
                    >
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
                    {tariff.price}
                    <button
                      type="button"
                      className="pay__copy"
                      onClick={() => copy(tariff.price.replace(/[^\d]/g, ""), "sum")}
                    >
                      {copied === "sum" ? "✓ Скопировано" : "Копировать"}
                    </button>
                  </span>
                </li>
                <li>
                  <span>Комментарий к переводу</span>
                  <span className="pay__val">
                    {comment}
                    <button
                      type="button"
                      className="pay__copy"
                      onClick={() => copy(comment, "comment")}
                    >
                      {copied === "comment" ? "✓ Скопировано" : "Копировать"}
                    </button>
                  </span>
                </li>
              </ul>
              <p className="pay__hint">
                Откройте приложение вашего банка → «Платежи» → «Перевод по
                номеру телефона» → выберите банк <strong>{pay.bank}</strong>.
                Обязательно укажите комментарий <strong>{comment}</strong> —
                так мы быстрее найдём ваш платёж.
              </p>
              {pay.link && (
                <a
                  className="btn btn--primary"
                  href={pay.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Оплатить по ссылке Т-Банка
                </a>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={reportPaid}
                disabled={busy}
              >
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
