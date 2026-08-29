// Шаг 1: отчётный год и виды вычетов. Несколько вычетов объединяются
// в одну декларацию — так и требует ФНС (одна 3-НДФЛ на год).
import { useState } from "react";
import { useWizard } from "../WizardContext.jsx";
import AutofillTeaser from "../AutofillTeaser.jsx";
import { wizardDeductions, HINTS, SALE_SLUGS, modeOf, saleKindOf } from "../../data/wizard.js";
import {
  YEARS,
  refundDeadlineYear,
  saleYearsFor,
  saleSupportedFor,
  MIXED_YEARS,
  mixedSupported,
} from "../../lib/ndfl/refs.js";
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
  const mode = modeOf(draft);
  const saleActive = mode === "sale";
  const mixed = mode === "mixed";
  // «Уточнёнка» — тихая опция: свёрнута в одну строку, основной флоу не
  // нагружает. Раскрыта, если корректировка уже выбрана или человек пришёл
  // по рекламной ссылке про уточнёнку (?korr=…): блок объясняет, что это,
  // но номер НЕ проставляется — см. комментарий в pages/Wizard.jsx.
  const [corrOpen, setCorrOpen] = useState(
    () =>
      Number(draft.correction) > 0 ||
      Boolean(new URLSearchParams(window.location.search).get("korr"))
  );
  const corr = Number(draft.correction) || 0;
  const setCorr = (n) => {
    if (n > 0 && corr === 0) ymGoal("correction_on", { n });
    dispatch({ type: "SET", key: "correction", value: n });
  };
  const pensionerTransfer =
    Boolean(draft.property?.pensioner) &&
    (draft.types.includes("kvartira") || draft.types.includes("ipoteka"));
  // При чистой продаже возвращать нечего — подпись про срок возврата не нужна.
  const note = saleActive ? null : yearNote(draft.year, pensionerTransfer);

  // За год подаётся ОДНА декларация, поэтому продажа и вычеты уживаются в ней
  // вместе. Плитки друг друга больше не гасят: снимается только то, что
  // человек снял сам, плюс вторая продажа (авто и недвижимость в одной
  // декларации мы пока не считаем).
  //
  // Год приходится подстраивать: продажу поддерживаем не за все годы, а
  // комбинацию — только с 2025-го, когда форма развела налоговые базы.
  const fixYear = (types) => {
    const sale = types.filter((t) => SALE_SLUGS.includes(t));
    if (!sale.length) return;
    const kind = types.includes("prodazha_realty") ? "realty" : "auto";
    const both = types.some((t) => !SALE_SLUGS.includes(t));
    if (both) {
      if (!mixedSupported(draft.year))
        dispatch({ type: "SET", key: "year", value: MIXED_YEARS[0] });
    } else if (!saleSupportedFor(kind, draft.year)) {
      dispatch({ type: "SET", key: "year", value: saleYearsFor(kind)[0] });
    }
  };

  const toggleRefund = (slug) => {
    const on = draft.types.includes(slug);
    const next = on
      ? draft.types.filter((t) => t !== slug)
      : [...draft.types, slug];
    // Разрез воронки по ситуациям: без параметра невозможно понять, какие
    // ситуации доходят до оплаты, а какие тонут (цель «situation»).
    if (!on) ymGoal("situation", { situation: slug });
    dispatch({ type: "SET", key: "types", value: next });
    fixYear(next);
  };

  // Продажа авто и недвижимости взаимоисключающие: две продажи в одной
  // декларации мы пока не считаем. Повторный клик по активной плитке снимает
  // продажу, оставляя выбранные вычеты на месте.
  const toggleSale = (slug) => {
    const rest = draft.types.filter((t) => !SALE_SLUGS.includes(t));
    if (draft.types.includes(slug)) {
      dispatch({ type: "SET", key: "types", value: rest });
      fixYear(rest);
      return;
    }
    const kind = slug === "prodazha_realty" ? "realty" : "auto";
    const next = [...rest, slug];
    ymGoal("situation", { situation: slug });
    dispatch({ type: "SET", key: "types", value: next });
    // Плитка задаёт вид ПЕРВОГО объекта. Остальные объекты и их виды человек
    // выбирает уже на шаге «Продажа» — там же список синхронизирует ситуации.
    dispatch({
      type: "PATCH_SALE",
      index: 0,
      patch: { kind, objectKind: kind === "realty" ? "flat" : "" },
    });
    fixYear(next);
  };

  // Список лет: при продаже он ограничен поддержанными формами, при
  // комбинации — годами, где базы разведены.
  const saleYears = saleYearsFor(saleKindOf(draft));
  const years = mixed
    ? [...YEARS].filter((y) => MIXED_YEARS.includes(y))
    : saleActive
      ? [...YEARS].filter((y) => saleYears.includes(y))
      : YEARS;

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
        {mixed && (
          <div className="doc-note doc-note--ok" style={{ marginTop: 10 }}>
            Продажу и вычеты вместе считаем за{" "}
            {[...MIXED_YEARS].sort((a, b) => a - b).join(", ")} год: с этого
            года форма разводит доход от продажи и зарплату по разным
            налоговым базам. За более ранние годы подайте их по отдельности
            или напишите в поддержку.
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
          ? "Продажа имущества — декларация с налогом к уплате. Если за этот же год вы хотите заявить вычет, отметьте его выше: всё уйдёт одной декларацией."
          : mixed
            ? "Продажа и вычеты попадут в ОДНУ декларацию — так и требует налоговая: одна 3-НДФЛ на год. Налог с продажи и возврат по вычетам она сведёт между собой."
            : "Все выбранные вычеты попадут в одну декларацию — так требует налоговая: одна 3-НДФЛ на один год."}
      </p>
      {!saleActive && <AutofillTeaser />}
    </div>
  );
}
