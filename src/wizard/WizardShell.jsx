// Оболочка мастера: прогресс по шагам, текущий шаг, кнопки Назад/Далее
// и сайдбар с живым расчётом возврата. Шаг «Документы» доступен только
// после оплаты (гейтинг дублируется внутри StepDocuments серверной проверкой).
import { useMemo, useRef, useState } from "react";
import { useWizard } from "./WizardContext.jsx";
import { useFeatureFlag } from "../lib/featureFlags.js";
import { ymGoal } from "../lib/metrika.js";
import { STEPS, PAYMENT_STEP, DOCUMENTS_STEP } from "../data/wizard.js";
import { validateStep } from "./validation.js";
import { computeDeclaration } from "../lib/ndfl/calc.js";
import { fmtRub } from "../lib/format.js";
import StepDeductions from "./steps/StepDeductions.jsx";
import StepPersonal from "./steps/StepPersonal.jsx";
import StepIncome from "./steps/StepIncome.jsx";
import StepDetails from "./steps/StepDetails.jsx";
import StepBank from "./steps/StepBank.jsx";
import StepReview from "./steps/StepReview.jsx";
import StepPayment from "./steps/StepPayment.jsx";
import StepDocuments from "./steps/StepDocuments.jsx";
import DocAutofill from "./DocAutofill.jsx";

const COMPONENTS = {
  types: StepDeductions,
  personal: StepPersonal,
  income: StepIncome,
  details: StepDetails,
  bank: StepBank,
  review: StepReview,
  payment: StepPayment,
  documents: StepDocuments,
};

export default function WizardShell({ resumeOffer, onResume, onRestart }) {
  const { draft, dispatch } = useWizard();
  const autofillOn = useFeatureFlag("doc_autofill");
  const [errors, setErrors] = useState({});
  const step = STEPS[draft.step] || STEPS[0];
  const Step = COMPONENTS[step.key];
  // Для навигации «оплачено» = есть хоть одна покупка или оплаченный заказ.
  // Соответствие покупки ТЕКУЩИМ данным проверяют сами шаги (по хешу анкеты):
  // если данные изменились, шаг «Документы» объяснит и отправит к оплате.
  const paid =
    draft.order?.status === "paid" || (draft.purchases || []).length > 0;

  const calc = useMemo(() => computeDeclaration(draft), [draft]);

  // Карта потерь: цель на первый заход на каждый шаг заполнения (types
  // покрыт целью wizard_open, payment — wizard_payment_step). Set — чтобы
  // возвраты «Назад/Далее» не накручивали цели повторно.
  const seenSteps = useRef(new Set([STEPS[draft.step]?.key]));
  const trackStep = (key) => {
    if (seenSteps.current.has(key)) return;
    seenSteps.current.add(key);
    if (["personal", "income", "details", "bank", "review"].includes(key))
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
          {/* Автозаполнение из документов — на первом шаге с полями.
              Показывается только при включённом серверном флаге. */}
          {step.key === "personal" && <DocAutofill />}
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
        </div>

        <aside className="wiz__aside">
          {/* Пока расчёта нет, «Вы вернёте 0 ₽» демотивирует (на мобильном
              карточка стоит НАД формой) — показываем потенциал вычета. */}
          <div className="calc__result wiz__aside-card">
            <div className="calc__result-label">
              {calc.refund > 0 ? "Вы вернёте" : "Вернуть можно"}
            </div>
            <div className="calc__result-value">
              {calc.refund > 0 ? fmtRub(calc.refund) : "до 260 000 ₽"}
            </div>
            <div className="calc__result-hint">
              {calc.refund > 0
                ? "Расчёт обновляется по мере заполнения"
                : "Ваша сумма посчитается на шагах «Доходы» и «Расходы»"}
            </div>
          </div>
          {/* При включённом автозаполнении «не отправляются на сервер» —
              уже не вся правда: загруженные файлы распознаются на сервере. */}
          <p className="wiz__aside-note">
            {autofillOn
              ? "Черновик сохраняется на этом устройстве автоматически. Документы формируются прямо в вашем браузере; файлы, загруженные для автозаполнения, распознаются на сервере и сразу удаляются — мы их не храним."
              : "Черновик сохраняется на этом устройстве автоматически. Паспортные данные не отправляются на сервер — документы формируются прямо в вашем браузере."}
          </p>
        </aside>
      </div>
    </div>
  );
}
