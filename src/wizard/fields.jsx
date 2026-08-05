// Переиспользуемые поля анкеты: подпись + подсказка «где взять» + ошибка.
// Стили — существующие form__field / form__error из index.css плюс wiz__*.
import { useId, useState } from "react";
import { todayIso } from "./validation.js";
export { fmtRub } from "../lib/format.js";

export function Field({ label, hint, error, children }) {
  return (
    <div className={"form__field" + (error ? " has-error" : "")}>
      <label>
        {label}
        {hint && <Hint text={hint} />}
      </label>
      {children}
      {error && <div className="form__error">{error}</div>}
    </div>
  );
}

// Подсказка-раскрывашка: знак вопроса рядом с подписью поля.
export function Hint({ text }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="wiz__hint-wrap">
      <button
        type="button"
        className="wiz__hint-btn"
        aria-label="Где взять эти данные"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span className="wiz__hint" id={id} role="note">
          {text}
        </span>
      )}
    </span>
  );
}

export function TextInput({ value, onChange, error, ...rest }) {
  return (
    <input
      type="text"
      className={error ? "is-error" : ""}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

// Денежное поле: числовая клавиатура на телефоне, только цифры.
// Суммы в декларации — рубли с копейками: справка о доходах даёт
// «1 693 820.60», и раньше поле вырезало всё, кроме цифр. Копейки было не
// ввести, а распознанное значение при первом же касании превращалось в
// 169382060 (лишний ноль). Разрешаем одну точку/запятую и два знака после.
export function normalizeMoney(raw) {
  let s = String(raw ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return s;
}

export function MoneyInput({ value, onChange, error, ...rest }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={error ? "is-error" : ""}
      placeholder="0"
      value={value === "" || value == null ? "" : String(value)}
      onChange={(e) => onChange(normalizeMoney(e.target.value))}
      {...rest}
    />
  );
}

export function DateInput({ value, onChange, error, ...rest }) {
  return (
    <input
      type="date"
      className={error ? "is-error" : ""}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      max={todayIso()}
      {...rest}
    />
  );
}

// Выпадающий список: options = [{ value, label }].
export function SelectInput({ value, onChange, options, error, ...rest }) {
  return (
    <select
      className={error ? "is-error" : ""}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
