// Страница мастера «Заполнить декларацию самому» (/deklaraciya/anketa).
// Отвечает за восстановление черновика и возврат со страницы оплаты ЮKassa
// (?order=<id> в query до #), сам мастер — в WizardShell.
import { useEffect, useMemo, useRef, useState } from "react";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  WizardProvider,
  useWizard,
  loadDraft,
  clearDraft,
} from "../wizard/WizardContext.jsx";
import WizardShell from "../wizard/WizardShell.jsx";
import { PAYMENT_STEP } from "../data/wizard.js";

function WizardBody() {
  const { dispatch } = useWizard();
  const [resumeOffer, setResumeOffer] = useState(null);
  // Черновик, прочитанный при заходе на страницу: «Продолжить» восстанавливает
  // именно его, а не повторное чтение localStorage (защита от перезаписи).
  const savedRef = useRef(null);

  // ?order=… приходит ДО решётки (return_url ЮKassa), поэтому читается
  // из window.location.search и при hash-роутинге.
  const returnedOrderId = useMemo(
    () => new URLSearchParams(window.location.search).get("order"),
    []
  );

  useEffect(() => {
    const saved = loadDraft();
    if (!saved) return;
    savedRef.current = saved;
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
        if (savedRef.current) dispatch({ type: "RESTORE", draft: savedRef.current });
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
