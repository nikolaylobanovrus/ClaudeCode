// Шаг 7: оплата услуги. Документы откроются автоматически после оплаты —
// шаг опрашивает статус заказа в базе (без действий оператора).
//
// Оплата привязана к содержимому анкеты (draftHash): одна оплата — один
// комплект документов для одного состояния данных. Изменение года или
// любых полей после оплаты требует новой оплаты; возврат тех же данных
// снова открывает уже оплаченный комплект (purchases в черновике).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWizard } from "../WizardContext.jsx";
import { selfService } from "../../data/content.js";
import { getAccount } from "../../lib/account.js";
import { fmtRub } from "../../lib/format.js";
import { computeDraftHash, draftSnapshot, findPurchase } from "../../lib/draftHash.js";
import {
  createOrder,
  createOperatorPaidOrder,
  payMockOrder,
  fetchOrderStatus,
  isTestPayment,
} from "../../lib/payments.js";
import { getOperatorToken } from "../../lib/supabase.js";

export default function StepPayment({ onPaid }) {
  const { draft, dispatch, flushDraft } = useWizard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hash, setHash] = useState(null); // null = ещё считается
  const order = draft.order;
  const canceled = order?.status === "canceled";

  // Хеш текущей анкеты (асинхронный — до готовности ничего не решаем).
  useEffect(() => {
    let alive = true;
    computeDraftHash(draft).then((h) => alive && setHash(h));
    return () => {
      alive = false;
    };
  }, [draft]);

  const purchase = findPurchase(draft, hash);
  const paidOrder = order?.status === "paid";

  // Заказ оплачен (поллинг или возврат с ЮKassa) → фиксируем покупку.
  // Хеш и снимок данных записаны в заказ при его создании — покупка всегда
  // соответствует данным, за которые клиент реально заплатил, даже если
  // анкету успели изменить, пока шла оплата.
  useEffect(() => {
    if (!paidOrder || hash === null) return;
    dispatch({
      type: "ADD_PURCHASE",
      purchase: {
        id: order.id,
        provider: order.provider,
        // status нужен fetchOrderStatus для local-заказов (без базы);
        // для mock/yookassa статус всё равно перепроверяется в базе.
        status: "paid",
        amount: order.amount,
        paidAt: new Date().toISOString(),
        draftHash: order.draftHash || hash,
        snapshot: order.snapshot || draftSnapshot(draft),
      },
    });
  }, [paidOrder, hash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Поллинг статуса: после редиректа с ЮKassa (или в соседней вкладке)
  // заказ становится paid — открываем документы автоматически.
  // paid и canceled — терминальные статусы, дальше не опрашиваем.
  const timer = useRef(0);
  useEffect(() => {
    if (!order || paidOrder || canceled || order.provider === "local") return undefined;
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

  // Режим оператора: сотрудник вошёл на /operator (токен Supabase Auth в
  // браузере) — документы формируются без оплаты. Заказ создаётся в базе
  // сразу оплаченным (RPC доступна только роли authenticated), поэтому
  // серверная проверка на шаге «Документы» проходит как обычно.
  const operator = Boolean(getOperatorToken());
  const [opExpired, setOpExpired] = useState(false);

  const startOperator = async () => {
    if (hash === null) return;
    setBusy(true);
    setError("");
    setOpExpired(false);
    try {
      const created = await createOperatorPaidOrder();
      dispatch({
        type: "SET_ORDER",
        order: { ...created, draftHash: hash, snapshot: draftSnapshot(draft) },
      });
    } catch (e) {
      if (e.status === 401 || e.status === 403) setOpExpired(true);
      else
        setError(
          "Не получилось создать заказ оператора. Проверьте интернет и что миграция operator-orders применена в Supabase." +
            (import.meta.env.DEV ? ` (${e.message})` : "")
        );
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (hash === null) return; // хеш ещё считается
    setBusy(true);
    setError("");
    try {
      let current = order;
      // Существующий заказ создан для других данных — он недействителен.
      if (current && current.draftHash && current.draftHash !== hash) {
        if (
          current.provider === "yookassa" &&
          current.status === "waiting" &&
          !window.confirm(
            "Данные анкеты изменились. Прежний неоплаченный счёт станет недействительным — не оплачивайте его. Создать новый счёт?"
          )
        ) {
          setBusy(false);
          return;
        }
        current = null;
      }
      // Незавершённый платёж ЮKassa с теми же данными: снова открываем ту же
      // платёжную страницу, а не создаём дубль заказа.
      if (
        current?.provider === "yookassa" &&
        current.status === "waiting" &&
        current.confirmationUrl
      ) {
        flushDraft();
        window.location.href = current.confirmationUrl;
        return;
      }
      if (!current || current.status === "canceled" || current.status === "paid") {
        const created = await createOrder(getAccount()?.id, {
          phone: draft.personal.phone,
          email: getAccount()?.email,
        });
        // Хеш и снимок анкеты фиксируются в заказе: оплата действует именно
        // для этих данных, что бы ни происходило с черновиком дальше.
        current = { ...created, draftHash: hash, snapshot: draftSnapshot(draft) };
        dispatch({ type: "SET_ORDER", order: current });
      }
      if (current.provider === "yookassa") {
        if (!current.confirmationUrl)
          throw new Error("платёжная страница не получена");
        // Черновик с id заказа должен лечь в localStorage ДО ухода со
        // страницы — иначе возврат с оплаты не найдёт заказ. Передаём заказ
        // явно: диспатч мог ещё не отрендериться.
        flushDraft({ order: current });
        window.location.href = current.confirmationUrl;
        return;
      }
      // Тестовый режим: имитируем успешную оплату.
      const paidMock = await payMockOrder(current);
      dispatch({ type: "SET_ORDER", order: paidMock });
    } catch (e) {
      setError(
        "Не получилось создать оплату. Проверьте интернет и попробуйте ещё раз." +
          (import.meta.env.DEV ? ` (${e.message})` : "")
      );
    } finally {
      setBusy(false);
    }
  };

  // Хеш ещё считается — нейтральное состояние, чтобы не мигать плашками.
  if (hash === null) {
    return <p className="wiz__note">Проверяем оплату…</p>;
  }

  // Текущее состояние анкеты уже оплачено (покупка найдена по хешу).
  if (purchase || (paidOrder && (order.draftHash || hash) === hash)) {
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

  const waiting =
    order?.provider === "yookassa" &&
    order?.status === "waiting" &&
    order?.draftHash === hash;
  const changedAfterPayment = (draft.purchases || []).length > 0;

  // Оператор: вместо карточки оплаты — формирование без оплаты.
  if (operator) {
    return (
      <div>
        <div className="wiz__pay card">
          <h3 className="card__title">Режим оператора</h3>
          <p className="card__text">
            Вы вошли как оператор — оплата не требуется. Комплект документов
            будет сформирован по текущим данным анкеты; заказ останется в базе
            с пометкой «operator» (0 ₽).
          </p>
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            disabled={busy}
            onClick={startOperator}
          >
            {busy ? "Создаём заказ…" : "Сформировать документы без оплаты"}
          </button>
          {opExpired && (
            <div className="doc-note doc-note--err" style={{ marginTop: 12 }}>
              Сессия оператора истекла. Войдите заново в{" "}
              <Link to="/operator">кабинет оператора</Link> и вернитесь сюда —
              анкета сохранится.
            </div>
          )}
          {error && <div className="form__error">{error}</div>}
        </div>
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
      {changedAfterPayment && (
        <div className="doc-note doc-note--err">
          Анкета изменилась после оплаты. Каждая декларация — за один год и на
          одного человека — оплачивается отдельно. Прежние оплаченные документы
          останутся доступны, если вернуть прежние данные.
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
        <div className="wiz__pay-price">{fmtRub(selfService.price)}</div>
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
        <p className="wiz__note">
          Оплата действует для текущих данных анкеты: одна декларация — один год,
          один человек. Изменение данных после оплаты — новая декларация и новая
          оплата.
        </p>
      </div>

      <p className="wiz__note">
        После оплаты автоматически откроются: декларация 3-НДФЛ (PDF), файл для
        Личного кабинета ФНС (XML) и заявление на возврат. Оферта — в разделе{" "}
        <Link to="/publichnaya-oferta">«Публичная оферта»</Link>.
      </p>
    </div>
  );
}
