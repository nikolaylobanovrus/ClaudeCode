// Оболочка мастера: прогресс по шагам, текущий шаг, кнопки Назад/Далее
// и сайдбар с живым расчётом возврата. Шаг «Документы» доступен только
// после оплаты (гейтинг дублируется внутри StepDocuments серверной проверкой).
import { useEffect, useMemo, useRef, useState } from "react";
import { useWizard } from "./WizardContext.jsx";
import { company } from "../data/content.js";
import { useFeatureFlag } from "../lib/featureFlags.js";
import { ymGoal } from "../lib/metrika.js";
import { stepsFor, stepIndexIn, isSaleDraft, potentialRefund } from "../data/wizard.js";
import { shareDraftLink } from "../lib/draftLink.js";
import { validateStep } from "./validation.js";
import { computeDeclaration } from "../lib/ndfl/calc.js";
import { fmtRub } from "../lib/format.js";
import StepDeductions from "./steps/StepDeductions.jsx";
import StepPersonal from "./steps/StepPersonal.jsx";
import StepIncome from "./steps/StepIncome.jsx";
import StepDetails from "./steps/StepDetails.jsx";
import StepSale from "./steps/StepSale.jsx";
import StepBank from "./steps/StepBank.jsx";
import StepReview from "./steps/StepReview.jsx";
import StepPayment from "./steps/StepPayment.jsx";
import StepDocuments from "./steps/StepDocuments.jsx";
import DocAutofill from "./DocAutofill.jsx";

// Кнопка «Продолжить на другом устройстве»: share-меню на мобильных,
// копирование ссылки на десктопе. Подпись подтверждает результат.
function ShareDraftButton({ draft }) {
  const [done, setDone] = useState(null); // "share" | "copy" | null
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: "100%" }}
        onClick={async () => {
          ymGoal("draft_link", { step: draft.step });
          setDone(await shareDraftLink(draft));
        }}
      >
        Продолжить на другом устройстве
      </button>
      {done === "copy" && (
        <p className="wiz__aside-note" style={{ marginTop: 6 }}>
          Ссылка на черновик скопирована — откройте её на другом устройстве.
        </p>
      )}
      {done === "share" && (
        <p className="wiz__aside-note" style={{ marginTop: 6 }}>
          Ссылка отправлена — черновик откроется по ней с текущими данными.
        </p>
      )}
    </div>
  );
}

const COMPONENTS = {
  types: StepDeductions,
  personal: StepPersonal,
  income: StepIncome,
  details: StepDetails,
  sale: StepSale,
  bank: StepBank,
  review: StepReview,
  payment: StepPayment,
  documents: StepDocuments,
};

export default function WizardShell({ resumeOffer, onResume, onRestart }) {
  const { draft, dispatch } = useWizard();
  const autofillOn = useFeatureFlag("doc_autofill");
  const [errors, setErrors] = useState({});
  // Маршрут шагов зависит от типа декларации: продажа идёт коротким путём
  // (без «Доходов» и «Счёта»). Переключение возможно только на шаге «types».
  const STEPS = stepsFor(draft);
  const PAYMENT_STEP = stepIndexIn(STEPS, "payment");
  const DOCUMENTS_STEP = stepIndexIn(STEPS, "documents");
  const sale = isSaleDraft(draft);
  const step = STEPS[draft.step] || STEPS[0];
  const Step = COMPONENTS[step.key];
  // Для навигации «оплачено» = есть хоть одна покупка или оплаченный заказ.
  // Соответствие покупки ТЕКУЩИМ данным проверяют сами шаги (по хешу анкеты):
  // если данные изменились, шаг «Документы» объяснит и отправит к оплате.
  const paid =
    draft.order?.status === "paid" || (draft.purchases || []).length > 0;

  const calc = useMemo(() => computeDeclaration(draft), [draft]);

  // Живая перепроверка: после «Далее» с ошибками каждое изменение анкеты
  // пересчитывает валидацию шага — исправленное поле сразу теряет красную
  // рамку, а не держит её до следующего клика. Пока ошибок нет, ничего не
  // проверяем: ошибки появляются только по кнопке «Далее».
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    setErrors(validateStep(step.key, draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Карта потерь: цель на первый заход на каждый шаг заполнения (types
  // покрыт целью wizard_open, payment — wizard_payment_step). Set — чтобы
  // возвраты «Назад/Далее» не накручивали цели повторно.
  const seenSteps = useRef(new Set([STEPS[draft.step]?.key]));
  const trackStep = (key) => {
    if (seenSteps.current.has(key)) return;
    seenSteps.current.add(key);
    if (["personal", "income", "details", "sale", "bank", "review"].includes(key))
      ymGoal(`wizard_step_${key}`);
  };

  const goto = (i) => {
    setErrors({});
    trackStep(STEPS[i]?.key);
    dispatch({ type: "GOTO", step: i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const e = validateStep(step.key, draft);
    setErrors(e);
    // Карта обрыва: человек ушёл с «Доходов» дальше, не заполнив справку —
    // считаем, сколько полей заполнено (0 — «продолжу позже» целиком).
    if (step.key === "income" && !Object.keys(e).length) {
      const filled = (draft.incomes || []).reduce(
        (s, inc) =>
          s +
          ["name", "inn", "oktmo", "income", "withheld"].filter(
            (f) => String(inc[f] || "").trim() !== ""
          ).length,
        0
      );
      const total = (draft.incomes || []).length * 5;
      if (filled < total) ymGoal("income_skip", { filled, total });
    }
    if (Object.keys(e).length) {
      // На телефоне ошибки остаются за экраном выше кнопки «Далее» —
      // без скролла клик выглядит как «ничего не произошло».
      requestAnimationFrame(() =>
        document
          .querySelector(".form__field.has-error")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
      return;
    }
    if (draft.step === PAYMENT_STEP && !paid) return; // вперёд только после оплаты
    goto(Math.min(draft.step + 1, STEPS.length - 1));
  };

  const back = () => goto(Math.max(draft.step - 1, 0));

  // Клик по точке прогресса: назад — свободно, вперёд — только на пройденное.
  const canJump = (i) => i <= draft.step && !(i > PAYMENT_STEP && !paid);

  return (
    <div className="wiz">
      {resumeOffer && (
        <div className="wiz__resume card">
          <p>
            У вас есть незаконченная анкета от {resumeOffer}. Продолжить с того же
            места?
          </p>
          <div className="doc-actions">
            <button type="button" className="btn btn--primary" onClick={onResume}>
              Продолжить
            </button>
            <button type="button" className="btn btn--ghost" onClick={onRestart}>
              Начать заново
            </button>
          </div>
        </div>
      )}

      <ol className="wiz__progress" aria-label="Шаги заполнения">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              className={
                "wiz__dot" +
                (i === draft.step ? " is-current" : "") +
                (i < draft.step ? " is-done" : "")
              }
              disabled={!canJump(i)}
              onClick={() => goto(i)}
            >
              <span className="wiz__dot-num">{i + 1}</span>
              <span className="wiz__dot-label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="wiz__grid">
        <div className="wiz__main">
          <h2 className="wiz__heading">{step.heading}</h2>
          {/* Автозаполнение из документов — на первом шаге с полями
              («Доходы»): справка 2-НДФЛ логично грузится именно здесь, а
              распознанное заполняет и последующие шаги (паспорт, расходы).
              Показывается только при включённом серверном флаге. */}
          {(step.key === "income" || step.key === "sale") && <DocAutofill />}
          <Step
            errors={errors}
            calc={calc}
            onPaid={() => goto(DOCUMENTS_STEP)}
            onUnpaid={() => goto(PAYMENT_STEP)}
          />

          {step.key !== "documents" && step.key !== "payment" && (
            <div className="wiz__nav">
              {draft.step > 0 && (
                <button type="button" className="btn btn--ghost" onClick={back}>
                  ← Назад
                </button>
              )}
              <button type="button" className="btn btn--primary btn--lg" onClick={next}>
                {step.key === "review" ? "Всё верно, к оплате →" : "Далее →"}
              </button>
            </div>
          )}
          {Object.keys(errors).length > 0 && (
            <p className="form__error" role="alert">
              Проверьте выделенные поля выше — не заполнено или с ошибкой:{" "}
              {Object.keys(errors).length}.
            </p>
          )}
          {step.key === "payment" && (
            <div className="wiz__nav">
              <button type="button" className="btn btn--ghost" onClick={back}>
                ← Назад
              </button>
            </div>
          )}

          {/* Живая поддержка на каждом шаге: человек не один на один с
              полями. Статичный блок в конце шага — НЕ липкая панель:
              ту убирали сознательно, она перекрывала кнопку «Оплатить». */}
          <p className="wiz__note wiz__help">
            💬 Возникли вопросы при заполнении? Позвоните — подскажем:{" "}
            <a
              href={`tel:${company.phoneRaw}`}
              onClick={() => ymGoal("wizard_help", { channel: "call", step: step.key })}
            >
              {company.phone}
            </a>{" "}
            или напишите в{" "}
            <a
              href={company.telegram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => ymGoal("wizard_help", { channel: "tg", step: step.key })}
            >
              Telegram
            </a>{" "}
            /{" "}
            <a
              href={company.max}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => ymGoal("wizard_help", { channel: "max", step: step.key })}
            >
              Max
            </a>
            .
          </p>
        </div>

        <aside className="wiz__aside">
          {/* Пока расчёта нет, «Вы вернёте 0 ₽» демотивирует (на мобильном
              карточка стоит НАД формой) — показываем потенциал вычета. */}
          <div className="calc__result wiz__aside-card">
            {sale ? (
              <>
                <div className="calc__result-label">Налог к уплате</div>
                <div className="calc__result-value">
                  {calc.sale?.price > 0 ? fmtRub(calc.owed) : "—"}
                </div>
                <div className="calc__result-hint">
                  {calc.sale?.price > 0
                    ? "Налог с дохода от продажи, 13%"
                    : "Посчитаем на шаге «Продажа»"}
                </div>
              </>
            ) : (
              (() => {
                // Живой личный потолок: как только введён удержанный налог,
                // абстрактное «до N ₽» превращается в цифру ИЗ ДАННЫХ
                // пользователя (вернуть больше удержанного НДФЛ нельзя).
                const withheldSum = (draft.incomes || []).reduce(
                  (s, i) => s + (Number(i.withheld) || 0),
                  0
                );
                const personalCap =
                  calc.refund <= 0 && withheldSum > 0
                    ? Math.min(withheldSum, potentialRefund(draft.types))
                    : 0;
                return (
                  <>
                    <div className="calc__result-label">
                      {calc.refund > 0
                        ? "Вы вернёте"
                        : personalCap > 0
                          ? "Ваш возврат"
                          : "Вернуть можно"}
                    </div>
                    <div className="calc__result-value">
                      {calc.refund > 0
                        ? fmtRub(calc.refund)
                        : `до ${fmtRub(personalCap || potentialRefund(draft.types))}`}
                    </div>
                    <div className="calc__result-hint">
                      {calc.refund > 0
                        ? "Расчёт обновляется по мере заполнения"
                        : personalCap > 0
                          ? "Посчитано по вашему удержанному налогу — уточнится после «Расходов»"
                          : "Ваша сумма посчитается на шагах «Доходы» и «Расходы»"}
                    </div>
                  </>
                );
              })()
            )}
          </div>
          {/* При включённом автозаполнении «не отправляются на сервер» —
              уже не вся правда: загруженные файлы распознаются на сервере. */}
          <p className="wiz__aside-note">
            {autofillOn
              ? "Черновик сохраняется на этом устройстве автоматически. Документы формируются прямо в вашем браузере; файлы, загруженные для автозаполнения, распознаются на сервере и сразу удаляются — мы их не храним."
              : "Черновик сохраняется на этом устройстве автоматически. Паспортные данные не отправляются на сервер — документы формируются прямо в вашем браузере."}
          </p>
          {/* Мобильный сценарий «начал с телефона — закончу с компьютера»:
              черновик уезжает в ссылке, оплаты остаются на этом устройстве. */}
          {step.key !== "documents" && (
            <ShareDraftButton draft={draft} />
          )}
        </aside>
      </div>
    </div>
  );
}
