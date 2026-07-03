import { useEffect, useState } from "react";
import PaymentBlock from "./PaymentBlock.jsx";
import { getAccount, updateAccount } from "../lib/account.js";
import { sbConfigured, sbRpc } from "../lib/supabase.js";

// Оплата открывается только после отметки оператора «Декларация направлена».
// Пока база (Supabase) не подключена — ведём себя как раньше (оплата видна).
// При сбое сети используем кэш из аккаунта, а без кэша не блокируем оплату
// (fail-open): сбой базы не должен мешать клиентам платить.
export default function GatedPayment({ title = "Оплата услуг", onStatus }) {
  const account = getAccount();
  const [sent, setSent] = useState(() => {
    if (!sbConfigured()) return true;
    if (!account) return true;
    if (account.declarationSent === true) return true;
    if (account.declarationSent === false) return false;
    return null; // статус ещё неизвестен — уточняем в базе
  });

  useEffect(() => {
    if (!sbConfigured() || !account) return;
    let alive = true;
    sbRpc("get_status", { p_id: account.id })
      .then((flag) => {
        if (!alive) return;
        const val = flag === true;
        setSent(val);
        updateAccount({ declarationSent: val });
        onStatus?.(val);
      })
      .catch(() => {
        if (!alive) return;
        const cached = account.declarationSent;
        const val = cached === false ? false : true;
        setSent(val);
        onStatus?.(val);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!account) return null;
  if (sent === null) return null; // короткое ожидание ответа базы

  if (sent === false) {
    return (
      <div className="pay">
        <h3 className="pay__title">{title}</h3>
        <p className="pay__note" data-testid="pay-waiting">
          Готовим ваши документы. Кнопка оплаты появится здесь, когда декларация
          будет направлена вам.
        </p>
      </div>
    );
  }

  return <PaymentBlock title={title} />;
}
