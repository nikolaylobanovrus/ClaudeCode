// Шаг 1: отчётный год и виды вычетов. Несколько вычетов объединяются
// в одну декларацию — так и требует ФНС (одна 3-НДФЛ на год).
import { useState } from "react";
import { useWizard } from "../WizardContext.jsx";
import AutofillTeaser from "../AutofillTeaser.jsx";
import { wizardDeductions, HINTS, SALE_SLUGS, isSaleDraft, saleKindOf } from "../../data/wizard.js";
import { YEARS, refundDeadlineYear, saleYearsFor, saleSupportedFor } from "../../lib/ndfl/refs.js";
import { Hint } from "../fields.jsx";
import { ymGoal } from "../../lib/metrika.js";

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
  // «Уточнёнка» — тихая опция: свёрнута в одну строку, основной флоу не
  // нагружает. Раскрыта, если уже включена (correction > 0 или deep-link).
  const [corrOpen, setCorrOpen] = useState(Number(draft.correction) > 0);
  const corr = Number(draft.correction) || 0;
  const setCorr = (n) => {
    if (n > 0 && corr === 0) ymGoal("correction_on", { n });
    dispatch({ type: "SET", key: "correction", value: n });
  };
  const pensionerTransfer =
    Boolean(draft.property?.pensioner) &&
    (draft.types.includes("kvartira") || draft.types.includes("ipoteka"));
  const note = saleActive ? null : yearNote(draft.year, pensionerTransfer);

  // Продажа и возврат — разные декларации, вместе не заявляются: выбор одного
  // очищает другой. Продажу декларируем только за поддержанные годы (2025).
  const toggleRefund = (slug) => {
    const cur = draft.types.filter((t) => !SALE_SLUGS.includes(t));
    const on = cur.includes(slug);
    const next = on ? cur.filter((t) => t !== slug) : [...cur, slug];
    // Разрез воронки по ситуациям: без параметра невозможно понять, какие
    // ситуации доходят до оплаты, а какие тонут (цель «situation»).
    if (!on) ymGoal("situation", { situation: slug });
    dispatch({ type: "SET", key: "types", value: next });
  };
  // Продажа авто и недвижимости — разные декларации, взаимоисключающие и с
  // возвратом несовместимы. Повторный клик по активной плитке снимает продажу.
  // Список поддержанных лет зависит от типа продажи (у недвижимости уже).
  const toggleSale = (slug) => {
    if (draft.types.includes(slug)) {
      dispatch({ type: "SET", key: "types", value: [] });
      return;
    }
    const kind = slug === "prodazha_realty" ? "realty" : "auto";
    ymGoal("situation", { situation: slug });
    dispatch({ type: "SET", key: "types", value: [slug] });
    dispatch({ type: "PATCH", section: "sale", patch: { kind } });
    if (!saleSupportedFor(kind, draft.year))
      dispatch({ type: "SET", key: "year", value: saleYearsFor(kind)[0] });
  };

  // При продаже год ограничен поддержанными формами (у недвижимости — уже).
  const saleYears = saleYearsFor(saleKindOf(draft));
  const years = saleActive ? [...YEARS].filter((y) => saleYears.includes(y)) : YEARS;

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
            Продажу декларируем за{" "}
            {[...saleYears].sort((a, b) => a - b).join(", ")} год — выберите
            нужный. За более ранние годы напишите в поддержку.
          </div>
        )}
        {note && (
          <div className={"doc-note doc-note--" + note.kind} style={{ marginTop: 10 }}>
            {note.text}
          </div>
        )}

        {/* Уточнённая (корректирующая) декларация — свёрнутая опция. */}
        <div style={{ marginTop: 10 }}>
          {!corrOpen && corr === 0 ? (
            <button
              type="button"
              className="wiz__edit"
              onClick={() => setCorrOpen(true)}
            >
              Подаёте уточнённую (корректирующую) декларацию?
            </button>
          ) : (
            <div className="doc-note doc-note--ok">
              <strong>Уточнённая декларация.</strong> Если вы уже подавали
              3-НДФЛ за {draft.year} год и нашли ошибку — подаётся уточнённая:
              та же декларация, заполненная заново <strong>целиком</strong> (все
              данные, а не только исправленное), с номером корректировки на
              титульном листе. Номер = сколько уточнёнок вы уже подавали + 1.
              <div className="calc__types" style={{ marginTop: 8 }}>
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={"calc__chip" + (corr === n ? " is-active" : "")}
                    onClick={() => setCorr(n)}
                  >
                    {n === 0 ? "Первичная" : `Корректировка ${n}`}
                  </button>
                ))}
              </div>
              {errors.correction && (
                <div className="form__error">{errors.correction}</div>
              )}
            </div>
          )}
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
          {[
            { slug: "prodazha_auto", icon: "🚗", title: "Продал автомобиль" },
            { slug: "prodazha_realty", icon: "🏠", title: "Продал недвижимость" },
          ].map((t) => {
            const active = draft.types.includes(t.slug);
            return (
              <button
                key={t.slug}
                type="button"
                className={"wiz__type" + (active ? " is-active" : "")}
                aria-pressed={active}
                onClick={() => toggleSale(t.slug)}
              >
                <span className="wiz__type-icon" aria-hidden="true">{t.icon}</span>
                <span>
                  <span className="wiz__type-title">{t.title}</span>
                  <span className="wiz__type-limit">рассчитаем налог к уплате</span>
                </span>
                <span className="wiz__type-check" aria-hidden="true">{active ? "✓" : ""}</span>
              </button>
            );
          })}
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
