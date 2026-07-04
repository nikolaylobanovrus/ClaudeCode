// Переиспользуемые поля анкеты: подпись + подсказка «где взять» + ошибка.
// Стили — существующие form__field / form__error из index.css плюс wiz__*.
import { useId, useState } from "react";

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
export function MoneyInput({ value, onChange, error, ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={error ? "is-error" : ""}
      placeholder="0"
      value={value === "" || value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
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
      max={new Date().toISOString().slice(0, 10)}
      {...rest}
    />
  );
}

export const fmtRub = (n) => (Math.round(Number(n) || 0)).toLocaleString("ru-RU") + " ₽";
