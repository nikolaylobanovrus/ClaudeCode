// Шаг 7: оплата услуги. Документы откроются автоматически после оплаты —
// шаг опрашивает статус заказа в базе (без действий оператора).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWizard } from "../WizardContext.jsx";
import { selfService } from "../../data/content.js";
import { getAccount } from "../../lib/account.js";
import {
  createOrder,
  payMockOrder,
  fetchOrderStatus,
  isTestPayment,
} from "../../lib/payments.js";
import { fmtRub } from "../fields.jsx";

export default function StepPayment({ onPaid }) {
  const { draft, dispatch } = useWizard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const order = draft.order;
  const paid = order?.status === "paid";

  // Поллинг статуса: после редиректа с ЮKassa (или в соседней вкладке)
  // заказ становится paid — открываем документы автоматически.
  const timer = useRef(0);
  useEffect(() => {
    if (!order || paid || order.provider === "local") return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const status = await fetchOrderStatus(order);
        if (!alive) return;
        if (status !== order.status)
          dispatch({ type: "SET_ORDER", order: { ...order, status } });
        if (status === "paid") return; // достигли цели — поллинг больше не нужен
      } catch {
        /* сеть мигнула — попробуем в следующем тике */
      }
      timer.current = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      let current = order;
      if (!current || current.status === "canceled") {
        current = await createOrder(getAccount()?.id);
        dispatch({ type: "SET_ORDER", order: current });
      }
      if (current.provider === "yookassa" && current.confirmationUrl) {
        // Уходим на платёжную страницу ЮKassa; вернёмся по return_url с ?order=
        window.location.href = current.confirmationUrl;
        return;
      }
      // Тестовый режим: имитируем успешную оплату.
      const paidOrder = await payMockOrder(current);
      dispatch({ type: "SET_ORDER", order: paidOrder });
    } catch (e) {
      setError(
        "Не получилось создать оплату. Проверьте интернет и попробуйте ещё раз." +
          (import.meta.env.DEV ? ` (${e.message})` : "")
      );
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <div>
        <div className="doc-note doc-note--ok">
          Оплата получена. Спасибо! Нажмите «Далее» — документы уже формируются.
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={onPaid}>
          Перейти к документам
        </button>
      </div>
    );
  }

  return (
    <div>
      {isTestPayment() && (
        <div className="doc-note doc-note--err">
          Тестовый режим: оплата имитируется, деньги не списываются. Перед запуском
          рекламы подключим ЮKassa — кнопка останется той же.
        </div>
      )}

      <div className="wiz__pay card">
        <h3 className="card__title">{selfService.name}</h3>
        <p className="card__text">{selfService.description}</p>
        <div className="wiz__pay-price">{fmtRub(selfService.price)}</div>
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={busy || order?.status === "waiting"}
          onClick={start}
        >
          {busy
            ? "Создаём платёж…"
            : order?.status === "waiting"
              ? "Ждём подтверждение оплаты…"
              : "Оплатить"}
        </button>
        {order?.status === "waiting" && (
          <p className="wiz__note">
            Если вы уже оплатили — не закрывайте страницу: подтверждение придёт
            в течение минуты, и документы откроются автоматически.
          </p>
        )}
        {error && <div className="form__error">{error}</div>}
      </div>

      <p className="wiz__note">
        После оплаты автоматически откроются: декларация 3-НДФЛ (PDF), файл для
        Личного кабинета ФНС (XML) и заявление на возврат. Оферта — в разделе{" "}
        <Link to="/publichnaya-oferta">«Публичная оферта»</Link>.
      </p>
    </div>
  );
}
