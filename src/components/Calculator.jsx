import { useMemo, useState } from "react";

// Калькулятор налогового вычета: считает 13% от суммы расходов
// с учётом лимитов по типу вычета. Инструмент повышает конверсию.
const TYPES = [
  { key: "kvartira", label: "Покупка жилья", cap: 2000000 },
  { key: "ipoteka", label: "Проценты по ипотеке", cap: 3000000 },
  { key: "lechenie", label: "Лечение", cap: 120000 },
  { key: "obuchenie", label: "Обучение", cap: 120000 },
  { key: "iis", label: "ИИС", cap: 400000 },
];

const fmt = (n) => n.toLocaleString("ru-RU");

export default function Calculator() {
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState(2000000);

  const refund = useMemo(() => {
    const base = Math.min(Number(amount) || 0, type.cap);
    return Math.round(base * 0.13);
  }, [amount, type]);

  return (
    <div className="calc">
      <div>
        <div className="calc__field">
          <label>Тип вычета</label>
          <div className="calc__types">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={"calc__chip" + (t.key === type.key ? " is-active" : "")}
                onClick={() => {
                  setType(t);
                  setAmount((a) => Math.min(Number(a) || 0, t.cap) || t.cap);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="calc__field" style={{ marginBottom: 6 }}>
          <label htmlFor="calc-amount">Сумма расходов, ₽</label>
          <input
            id="calc-amount"
            className="calc__input"
            type="number"
            min="0"
            max={type.cap}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="calc__range"
            type="range"
            min="0"
            max={type.cap}
            step="10000"
            value={Math.min(Number(amount) || 0, type.cap)}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Сумма расходов"
          />
        </div>
        <p style={{ color: "var(--ink-500)", fontSize: 13 }}>
          Максимальная база для этого вычета — {fmt(type.cap)} ₽.
        </p>
      </div>

      <div className="calc__result">
        <div className="calc__result-label">Вы можете вернуть</div>
        <div className="calc__result-value">{fmt(refund)} ₽</div>
        <div className="calc__result-hint">
          Это 13% от суммы расходов в пределах лимита
        </div>
      </div>
    </div>
  );
}
