// Шаг 1: отчётный год и виды вычетов. Несколько вычетов объединяются
// в одну декларацию — так и требует ФНС (одна 3-НДФЛ на год).
import { useWizard } from "../WizardContext.jsx";
import AutofillTeaser from "../AutofillTeaser.jsx";
import { wizardDeductions, HINTS, SALE_SLUGS, isSaleDraft } from "../../data/wizard.js";
import { YEARS, refundDeadlineYear, SALE_YEARS, saleSupported } from "../../lib/ndfl/refs.js";
import { Hint } from "../fields.jsx";

// Подпись о сроке возврата под выбором года: возврат возможен за три
// последних года, за более старые налоговая откажет. Для пенсионера с
// переносом имущественного вычета (п. 10 ст. 220 НК) — не ошибка.
function yearNote(year, pensionerTransfer) {
  const nowYear = new Date().getFullYear();
  const deadline = refundDeadlineYear(year);
  if (nowYear > deadline) {
    if (pensionerTransfer)
      return {
        kind: "ok",
        text: `Вы отметили, что вы пенсионер: возврат за ${year} год по имущественному вычету возможен — остаток переносится на прошлые годы (п. 10 ст. 220 НК).`,
      };
    return {
      kind: "err",
      text: `Срок возврата за ${year} год истёк — вернуть налог можно только за три последних года. Исключение: пенсионеры по имущественному вычету (отметка «Я пенсионер» — дальше, на шаге «Расходы»).`,
    };
  }
  if (nowYear === deadline)
    return {
      kind: "ok",
      text: `${nowYear} — последний год, когда можно вернуть налог за ${year}. Успейте подать декларацию до конца года.`,
    };
  return null;
}

export default function StepDeductions({ errors }) {
  const { draft, dispatch } = useWizard();
  const saleActive = isSaleDraft(draft);
  const pensionerTransfer =
    Boolean(draft.property?.pensioner) &&
    (draft.types.includes("kvartira") || draft.types.includes("ipoteka"));
  const note = saleActive ? null : yearNote(draft.year, pensionerTransfer);

  // Продажа и возврат — разные декларации, вместе не заявляются: выбор одного
  // очищает другой. Продажу декларируем только за поддержанные годы (2025).
  const toggleRefund = (slug) => {
    const cur = draft.types.filter((t) => !SALE_SLUGS.includes(t));
    const next = cur.includes(slug) ? cur.filter((t) => t !== slug) : [...cur, slug];
    dispatch({ type: "SET", key: "types", value: next });
  };
  const toggleSale = () => {
    if (saleActive) {
      dispatch({ type: "SET", key: "types", value: [] });
    } else {
      dispatch({ type: "SET", key: "types", value: ["prodazha_auto"] });
      if (!saleSupported(draft.year))
        dispatch({ type: "SET", key: "year", value: SALE_YEARS[0] });
    }
  };

  // При продаже год ограничен поддержанными формами.
  const years = saleActive ? [...YEARS].filter(saleSupported) : YEARS;

  return (
    <div>
      <div className="form__field">
        <label>
          {saleActive ? "За какой год декларируем продажу" : "За какой год возвращаем налог"}
          <Hint text={HINTS.year} />
        </label>
        <div className="calc__types">
          {/* по возрастанию: 2022 → 2025 (в YEARS годы от свежего к старому) */}
          {[...years].reverse().map((y) => (
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
        {saleActive && (
          <div className="doc-note doc-note--ok" style={{ marginTop: 10 }}>
            Продажу автомобиля декларируем за {SALE_YEARS[0]} год (действующая
            форма ФНС). За другие годы — напишите в поддержку.
          </div>
        )}
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
                onClick={() => toggleRefund(d.slug)}
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

      <div className="form__field">
        <label>…или задекларируйте доход от продажи</label>
        <div className="wiz__types">
          <button
            type="button"
            className={"wiz__type" + (saleActive ? " is-active" : "")}
            aria-pressed={saleActive}
            onClick={toggleSale}
          >
            <span className="wiz__type-icon" aria-hidden="true">🚗</span>
            <span>
              <span className="wiz__type-title">Продал автомобиль</span>
              <span className="wiz__type-limit">рассчитаем налог к уплате</span>
            </span>
            <span className="wiz__type-check" aria-hidden="true">{saleActive ? "✓" : ""}</span>
          </button>
        </div>
      </div>

      <p className="wiz__note">
        {saleActive
          ? "Продажа имущества — отдельная декларация с налогом к уплате. Её нельзя объединить с вычетами на возврат."
          : "Все выбранные вычеты попадут в одну декларацию — так требует налоговая: одна 3-НДФЛ на один год."}
      </p>
      {!saleActive && <AutofillTeaser />}
    </div>
  );
}
