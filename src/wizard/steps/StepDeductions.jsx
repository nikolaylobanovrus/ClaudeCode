// Шаг 1: отчётный год и виды вычетов. Несколько вычетов объединяются
// в одну декларацию — так и требует ФНС (одна 3-НДФЛ на год).
import { useWizard } from "../WizardContext.jsx";
import { wizardDeductions, HINTS } from "../../data/wizard.js";
import { YEARS, refundDeadlineYear } from "../../lib/ndfl/refs.js";
import { Hint } from "../fields.jsx";

// Подпись о сроке возврата под выбором года: возврат возможен за три
// последних года, за более старые налоговая откажет.
function yearNote(year) {
  const nowYear = new Date().getFullYear();
  const deadline = refundDeadlineYear(year);
  if (nowYear > deadline)
    return {
      kind: "err",
      text: `Срок возврата за ${year} год истёк — вернуть налог можно только за три последних года. Исключение: пенсионеры по имущественному вычету.`,
    };
  if (nowYear === deadline)
    return {
      kind: "ok",
      text: `${nowYear} — последний год, когда можно вернуть налог за ${year}. Успейте подать декларацию до конца года.`,
    };
  return null;
}

export default function StepDeductions({ errors }) {
  const { draft, dispatch } = useWizard();
  const note = yearNote(draft.year);

  return (
    <div>
      <div className="form__field">
        <label>
          За какой год возвращаем налог
          <Hint text={HINTS.year} />
        </label>
        <div className="calc__types">
          {/* по возрастанию: 2022 → 2025 (в YEARS годы от свежего к старому) */}
          {[...YEARS].reverse().map((y) => (
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
        {note && (
          <div className={"doc-note doc-note--" + note.kind} style={{ marginTop: 10 }}>
            {note.text}
          </div>
        )}
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
