// Шаг 7: оплата услуги. Документы откроются автоматически после оплаты —
// шаг опрашивает статус заказа в базе (без действий оператора).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWizard } from "../WizardContext.jsx";
import { selfService } from "../../data/content.js";
import { getAccount } from "../../lib/account.js";
import { fmtRub } from "../../lib/format.js";
import {
  createOrder,
  payMockOrder,
  fetchOrderStatus,
  isTestPayment,
} from "../../lib/payments.js";

export default function StepPayment({ onPaid }) {
  const { draft, dispatch, flushDraft } = useWizard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const order = draft.order;
  const paid = order?.status === "paid";
  const canceled = order?.status === "canceled";

  // Поллинг статуса: после редиректа с ЮKassa (или в соседней вкладке)
  // заказ становится paid — открываем документы автоматически.
  // paid и canceled — терминальные статусы, дальше не опрашиваем.
  const timer = useRef(0);
  useEffect(() => {
    if (!order || paid || canceled || order.provider === "local") return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const status = await fetchOrderStatus(order);
        if (!alive) return;
        if (status !== order.status)
          dispatch({ type: "SET_ORDER", order: { ...order, status } });
        if (status === "paid" || status === "canceled") return;
      } catch {
        /* сеть мигнула — попробуем в следующем тике */
      }
      if (alive) timer.current = setTimeout(tick, 3000);
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
      // Незавершённый платёж ЮKassa: снова открываем ту же платёжную
      // страницу, а не создаём дубль заказа.
      if (order?.provider === "yookassa" && order.status === "waiting" && order.confirmationUrl) {
        flushDraft();
        window.location.href = order.confirmationUrl;
        return;
      }
      let current = order;
      if (!current || current.status === "canceled") {
        current = await createOrder(getAccount()?.id, {
          phone: draft.personal.phone,
          email: getAccount()?.email,
        });
        dispatch({ type: "SET_ORDER", order: current });
      }
      if (current.provider === "yookassa") {
        if (!current.confirmationUrl)
          throw new Error("платёжная страница не получена");
        // Черновик с id заказа должен лечь в localStorage ДО ухода со
        // страницы — иначе возврат с оплаты не найдёт заказ.
        flushDraft();
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
          Оплата получена. Спасибо! Документы уже формируются.
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={onPaid}>
          Перейти к документам
        </button>
      </div>
    );
  }

  const waiting = order?.provider === "yookassa" && order?.status === "waiting";

  return (
    <div>
      {isTestPayment() && (
        <div className="doc-note doc-note--err">
          Тестовый режим: оплата имитируется, деньги не списываются. Перед запуском
          рекламы подключим ЮKassa — кнопка останется той же.
        </div>
      )}
      {canceled && (
        <div className="doc-note doc-note--err">
          Платёж был отменён. Нажмите «Оплатить» ещё раз — мы создадим новый.
        </div>
      )}

      <div className="wiz__pay card">
        <h3 className="card__title">{selfService.name}</h3>
        <p className="card__text">{selfService.description}</p>
        <div className="wiz__pay-price">{fmtRub(order?.amount ?? selfService.price)}</div>
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          disabled={busy}
          onClick={start}
        >
          {busy
            ? "Создаём платёж…"
            : waiting
              ? "Продолжить оплату"
              : "Оплатить"}
        </button>
        {waiting && (
          <p className="wiz__note">
            Уже оплатили? Не закрывайте страницу: подтверждение придёт в течение
            минуты, и документы откроются автоматически. Если страница оплаты
            закрылась раньше времени — нажмите «Продолжить оплату».
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
