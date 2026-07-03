import { useEffect, useState } from "react";
import PaymentBlock from "./PaymentBlock.jsx";
import { getAccount, updateAccount } from "../lib/account.js";
import { sbConfigured, sbRpc } from "../lib/supabase.js";

// Оплата открывается, когда оператор назначил тариф/сумму (amount > 0).
// Пока база не подключена — показываем блок с суммой из аккаунта, если она
// уже была назначена, иначе fail-open как раньше (сумма 0 → скрыто).
export default function GatedPayment({ title = "Оплата услуг", onStatus }) {
  const account = getAccount();

  // state: null (ждём), либо { amount, tariff }
  const [pay, setPay] = useState(() => {
    if (!sbConfigured()) {
      return { amount: account?.paymentAmount || 0, tariff: account?.paymentTariff || "" };
    }
    if (!account) return { amount: 0, tariff: "" };
    if (account.paymentAmount != null) {
      return { amount: account.paymentAmount, tariff: account.paymentTariff || "" };
    }
    return null; // ещё не знаем — уточняем в базе
  });

  useEffect(() => {
    if (!sbConfigured() || !account) return;
    let alive = true;
    const cached = () => ({
      amount: account.paymentAmount || 0,
      tariff: account.paymentTariff || "",
    });
    const guard = setTimeout(() => {
      if (!alive) return;
      setPay((cur) => cur ?? cached());
    }, 9000);
    sbRpc("get_payment", { p_id: account.id })
      .then((row) => {
        if (!alive) return;
        clearTimeout(guard);
        const amount = Number(row?.amount || 0);
        const tariff = row?.tariff || "";
        setPay({ amount, tariff });
        updateAccount({ paymentAmount: amount, paymentTariff: tariff });
        onStatus?.(amount > 0);
      })
      .catch(() => {
        clearTimeout(guard);
        if (!alive) return;
        const c = cached();
        setPay(c);
        onStatus?.(c.amount > 0);
      });
    return () => {
      alive = false;
      clearTimeout(guard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!account) return null;
  if (pay === null) return null; // короткое ожидание базы

  if (!(pay.amount > 0)) {
    return (
      <div className="pay">
        <h3 className="pay__title">{title}</h3>
        <p className="pay__note" data-testid="pay-waiting">
          Готовим ваши документы. Кнопка оплаты появится здесь, когда специалист
          подготовит документы и выставит сумму.
        </p>
      </div>
    );
  }

  return <PaymentBlock title={title} tariffName={pay.tariff} amount={pay.amount} />;
}
