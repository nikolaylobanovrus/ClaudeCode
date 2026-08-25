// «Заполним за вас» — предложение услуги под ключ прямо в анкете.
//
// Зачем: самозаполнение стоит 199 ₽ при цене привлечения клиента около
// 850 ₽, и реклама в таком виде не окупается. Тарифы «под ключ» (990–1 540 ₽)
// у нас уже есть, оператор и его кабинет работают — не хватало только
// предложения там, где человек упирается: реквизиты справки, паспортные
// данные, экран оплаты.
//
// Блок сознательно скромный: свёрнутая строка, никаких перекрытий формы.
// Тот, кто заполняет сам, просто её не замечает.
import { useState } from "react";
import { useWizard } from "./WizardContext.jsx";
import { sendFormEmail } from "../lib/mailer.js";
import { ymGoal } from "../lib/metrika.js";
import { tariffs } from "../data/content.js";

// Минимальная цена «под ключ» — из общего прайса, чтобы обещание в анкете
// не разошлось с тарифами на сайте.
const FROM = tariffs.reduce(
  (min, t) => Math.min(min, Number(String(t.price).replace(/\D/g, "")) || Infinity),
  Infinity
);

const PHONE_DIGITS = 11;

export default function TurnkeyOffer({ stepKey }) {
  const { draft } = useWizard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const toggle = () => {
    setOpen((v) => {
      if (!v) ymGoal("turnkey_open", { step: stepKey });
      return !v;
    });
  };

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Напишите, как к вам обращаться.");
      return;
    }
    if (phone.replace(/\D/g, "").length < PHONE_DIGITS) {
      setError("Проверьте телефон — нужны все 11 цифр.");
      return;
    }
    setBusy(true);
    try {
      // Тот же канал, что у остальных форм сайта: письмо, при сбое почты —
      // запись в базу, откуда заявку видит оператор в своём кабинете.
      await sendFormEmail("Заявка «под ключ» из анкеты", {
        Имя: name.trim(),
        Телефон: phone.trim(),
        Шаг: stepKey,
        Год: String(draft.year),
        Ситуации: (draft.types || []).join(", ") || "не выбраны",
      });
      ymGoal("turnkey_lead", { step: stepKey });
      setDone(true);
    } catch {
      setError(
        "Не получилось отправить заявку. Позвоните или напишите нам — контакты внизу страницы."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="doc-note doc-note--ok turnkey">
        <strong>Заявка принята.</strong> Перезвоним в рабочее время, обсудим
        документы и сроки. Анкета никуда не денется — черновик сохранён, можете
        продолжить сами в любой момент.
      </div>
    );

  return (
    <div className="turnkey">
      <button type="button" className="turnkey__head" onClick={toggle} aria-expanded={open}>
        <span className="turnkey__title">
          🤝 Не хочется возиться? Заполним за вас — от {FROM} ₽
        </span>
        <span className="turnkey__chev">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <form className="turnkey__body" onSubmit={submit} noValidate>
          <p className="wiz__note" style={{ marginTop: 0 }}>
            Вы присылаете документы, декларацию делает наш специалист и
            присылает готовый комплект. Оставьте телефон — перезвоним, уточним
            вашу ситуацию и назовём точную цену.
          </p>
          <div className="wiz__row">
            <div className="form__field">
              <label htmlFor="tk-name">Как к вам обращаться</label>
              <input
                id="tk-name"
                type="text"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван"
              />
            </div>
            <div className="form__field">
              <label htmlFor="tk-phone">Телефон</label>
              <input
                id="tk-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (900) 000-00-00"
              />
            </div>
          </div>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Отправляем…" : "Перезвоните мне"}
          </button>
          <p className="autofill__privacy">
            Телефон нужен только для звонка по вашей заявке. Продолжать самому
            это не мешает — анкета остаётся на месте.
          </p>
        </form>
      )}
    </div>
  );
}
