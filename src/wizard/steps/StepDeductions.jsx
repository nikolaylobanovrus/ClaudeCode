// Шаг 1: отчётный год и виды вычетов. Несколько вычетов объединяются
// в одну декларацию — так и требует ФНС (одна 3-НДФЛ на год).
import { useWizard } from "../WizardContext.jsx";
import { wizardDeductions, HINTS } from "../../data/wizard.js";
import { YEARS } from "../../lib/ndfl/refs.js";
import { Hint } from "../fields.jsx";

export default function StepDeductions({ errors }) {
  const { draft, dispatch } = useWizard();

  return (
    <div>
      <div className="form__field">
        <label>
          За какой год возвращаем налог
          <Hint text={HINTS.year} />
        </label>
        <div className="calc__types">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              className={"calc__chip" + (draft.year === y ? " is-active" : "")}
              onClick={() => dispatch({ type: "SET", key: "year", value: y })}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="form__field">
        <label>Выберите одну или несколько ситуаций</label>
        <div className="wiz__types">
          {wizardDeductions.map((d) => {
            const active = draft.types.includes(d.slug);
            return (
              <button
                key={d.slug}
                type="button"
                className={"wiz__type" + (active ? " is-active" : "")}
                aria-pressed={active}
                onClick={() => dispatch({ type: "TOGGLE_TYPE", slug: d.slug })}
              >
                <span className="wiz__type-icon" aria-hidden="true">
                  {d.icon}
                </span>
                <span>
                  <span className="wiz__type-title">{d.title}</span>
                  <span className="wiz__type-limit">возврат {d.limit}</span>
                </span>
                <span className="wiz__type-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {errors.types && <div className="form__error">{errors.types}</div>}
      </div>

      <p className="wiz__note">
        Все выбранные вычеты попадут в одну декларацию — так требует налоговая:
        одна 3-НДФЛ на один год.
      </p>
    </div>
  );
}
