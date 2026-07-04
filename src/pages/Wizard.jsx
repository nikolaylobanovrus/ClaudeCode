// Страница мастера «Заполнить декларацию самому» (/deklaraciya/anketa).
// Отвечает за восстановление черновика и возврат со страницы оплаты ЮKassa
// (?order=<id> в query до #), сам мастер — в WizardShell.
import { useEffect, useMemo, useState } from "react";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  WizardProvider,
  useWizard,
  loadDraft,
  clearDraft,
} from "../wizard/WizardContext.jsx";
import WizardShell from "../wizard/WizardShell.jsx";
import { STEPS } from "../data/wizard.js";

const PAYMENT_STEP = STEPS.findIndex((s) => s.key === "payment");

function WizardBody() {
  const { dispatch } = useWizard();
  const [resumeOffer, setResumeOffer] = useState(null);

  // ?order=… приходит ДО решётки (return_url ЮKassa), поэтому читается
  // из window.location.search и при hash-роутинге.
  const returnedOrderId = useMemo(
    () => new URLSearchParams(window.location.search).get("order"),
    []
  );

  useEffect(() => {
    const saved = loadDraft();
    if (!saved) return;
    if (returnedOrderId && saved.order?.id === returnedOrderId) {
      // Вернулись с оплаты: сразу на шаг оплаты, поллинг подтвердит платёж
      // и автоматически откроет документы.
      dispatch({ type: "RESTORE", draft: { ...saved, step: PAYMENT_STEP } });
      return;
    }
    if (saved.types?.length || saved.personal?.lastName) {
      const when = saved.savedAt
        ? new Date(saved.savedAt).toLocaleDateString("ru-RU")
        : "прошлого визита";
      setResumeOffer(when);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WizardShell
      resumeOffer={resumeOffer}
      onResume={() => {
        const saved = loadDraft();
        if (saved) dispatch({ type: "RESTORE", draft: saved });
        setResumeOffer(null);
      }}
      onRestart={() => {
        clearDraft();
        dispatch({ type: "RESET" });
        setResumeOffer(null);
      }}
    />
  );
}

export default function Wizard() {
  return (
    <>
      <Seo
        title="Анкета 3-НДФЛ — заполнение декларации онлайн | Налог-сервис"
        description="Пошаговая анкета для автоматического формирования декларации 3-НДФЛ: подсказки к каждому полю, расчёт возврата, документы сразу после оплаты."
        path="/deklaraciya/anketa"
        noindex
      />
      <PageHero
        eyebrow="Заполнить самому"
        title="Анкета для декларации 3-НДФЛ"
        subtitle="Отвечайте на вопросы — мы считаем вычет и формируем документы. Черновик сохраняется автоматически."
        crumbs={["Заполнить самому"]}
      />
      <section className="section">
        <div className="container">
          <WizardProvider>
            <WizardBody />
          </WizardProvider>
        </div>
      </section>
    </>
  );
}
