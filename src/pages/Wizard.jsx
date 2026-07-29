// Страница мастера «Заполнить декларацию самому» (/deklaraciya/anketa).
// Отвечает за восстановление черновика и возврат со страницы оплаты ЮKassa
// (?order=<id> в query до #), сам мастер — в WizardShell.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import {
  WizardProvider,
  useWizard,
  loadDraft,
  clearDraft,
} from "../wizard/WizardContext.jsx";
import WizardShell from "../wizard/WizardShell.jsx";
import { paymentStepFor, SALE_SLUGS } from "../data/wizard.js";
import { decodeDraftLink } from "../lib/draftLink.js";
import { ymGoal } from "../lib/metrika.js";

// Ситуации, которые объявление может передать в ссылке (?s=… до решётки):
// клик по «вычет за лечение» открывает анкету с уже выбранной плиткой —
// на телефоне это убирает скролл пятнадцати плиток до кнопки «Далее».
const PRESELECT_SLUGS = [
  "kvartira", "ipoteka", "lechenie", "obuchenie", "iis", "strahovanie",
  ...SALE_SLUGS,
];

function WizardBody() {
  const { dispatch } = useWizard();
  const [resumeOffer, setResumeOffer] = useState(null);
  // Плашка вычета на лендинге передаёт свой slug через state роутера —
  // анкета открывается с уже проставленной галочкой.
  const preselect = useLocation().state?.deduction;
  // Черновик, прочитанный при заходе на страницу: «Продолжить» восстанавливает
  // именно его, а не повторное чтение localStorage (защита от перезаписи).
  const savedRef = useRef(null);

  // ?order=… приходит ДО решётки (return_url ЮKassa), поэтому читается
  // из window.location.search и при hash-роутинге.
  const returnedOrderId = useMemo(
    () => new URLSearchParams(window.location.search).get("order"),
    []
  );

  // Цель Метрики: пользователь открыл анкету (вершина воронки самозаполнения).
  // returning=1 — вернулся к начатому черновику: доля возвращающихся проверяет
  // гипотезу «посмотрю сейчас, заполню когда дойдут руки».
  useEffect(() => {
    const saved = loadDraft();
    const returning =
      !!saved && ((saved.types || []).length > 0 || (saved.step || 0) > 0);
    ymGoal("wizard_open", { returning: returning ? 1 : 0 });
  }, []);

  useEffect(() => {
    // Черновик из ссылки «Продолжить на другом устройстве» (?d=… до решётки):
    // важнее локального — человек осознанно перенёс данные с телефона.
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("d") && decodeDraftLink(params.get("d"));
    if (linked) {
      dispatch({ type: "RESTORE", draft: linked });
      // Убираем гигантский параметр из адресной строки (перезагрузка страницы
      // не должна повторно затирать черновик, который человек начал править).
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      return;
    }
    const saved = loadDraft();
    if (!saved) {
      // Ситуация из объявления (?s=lechenie) или с плашки лендинга (state).
      const s = params.get("s");
      const slug = preselect || (PRESELECT_SLUGS.includes(s) ? s : null);
      if (slug && SALE_SLUGS.includes(slug)) {
        // Свежий черновик стартует с года YEARS[0] (2025) — он поддержан
        // и для авто, и для недвижимости, менять год не нужно.
        const kind = slug === "prodazha_realty" ? "realty" : "auto";
        dispatch({ type: "SET", key: "types", value: [slug] });
        dispatch({ type: "PATCH", section: "sale", patch: { kind } });
      } else if (slug) {
        dispatch({ type: "TOGGLE_TYPE", slug });
      }
      return;
    }
    // Легаси-черновики: paid-заказ времён до появления покупок превращаем
    // в покупку со снимком сохранённых данных — оплаченное не пропадает.
    if (saved.order?.status === "paid" && !(saved.purchases || []).length) {
      import("../lib/draftHash.js").then(async ({ computeDraftHash, draftSnapshot }) => {
        const hash = await computeDraftHash(saved);
        dispatch({
          type: "ADD_PURCHASE",
          purchase: {
            id: saved.order.id,
            provider: saved.order.provider,
            amount: saved.order.amount,
            paidAt: saved.savedAt || null,
            draftHash: hash,
            snapshot: draftSnapshot(saved),
          },
        });
      });
    }
    savedRef.current = saved;
    if (returnedOrderId && saved.order?.id === returnedOrderId) {
      // Вернулись с оплаты: сразу на шаг оплаты, поллинг подтвердит платёж
      // и автоматически откроет документы.
      dispatch({ type: "RESTORE", draft: { ...saved, step: paymentStepFor(saved) } });
      return;
    }
    // Черновик с оплаченным содержимым восстанавливаем сразу: случайная
    // правка пустой анкеты под баннером затёрла бы оплаченный доступ.
    if ((saved.purchases || []).length || saved.order?.status === "paid") {
      dispatch({ type: "RESTORE", draft: saved });
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
