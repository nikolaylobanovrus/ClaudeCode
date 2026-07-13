// Лендинг услуги «Заполнить декларацию самому»: отдельная точка входа для
// рекламы (Авито, директ) — свой оффер, цена и CTA, дизайн — общий с сайтом.
// Сам мастер — на /deklaraciya/anketa.
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Faq from "../components/Faq.jsx";
import { company, selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";
import { wizardDeductions } from "../data/wizard.js";
import { useFeatureFlag } from "../lib/featureFlags.js";

// Тексты про автозаполнение из документов включаются серверным флагом
// doc_autofill (как и сам блок в мастере): выключили фичу — реклама
// исчезает вместе с ней, лендинг выглядит как раньше (fail-closed).
// SEO-тексты (title/description, JSON-LD Service) фичу намеренно НЕ
// упоминают: сниппет в поисковой выдаче киллсвитчем не выключить.
const buildHow = (autofillOn) => [
  {
    num: "1",
    title: "Отвечаете на вопросы",
    text: autofillOn
      ? "Простая анкета с подсказками «где взять цифру». Можно загрузить фото справки о доходах и договоров — поля заполнятся сами, останется проверить. 10–15 минут."
      : "Простая анкета с подсказками «где взять цифру»: справка о доходах, договор, чеки. 10–15 минут.",
  },
  {
    num: "2",
    title: "Оплачиваете",
    text: `Фиксированная цена — ${fmtRub(selfService.price)}, без процентов от возврата.`,
  },
  {
    num: "3",
    title: "Получаете документы",
    text: "Декларация 3-НДФЛ, файл для Личного кабинета ФНС и заявление на возврат — сразу после оплаты.",
  },
  {
    num: "4",
    title: "Подаёте в налоговую",
    text: "Загружаете файл в Личный кабинет ФНС или отдаёте лично / отправляете по почте в ФНС — и ждёте деньги на счёт. Инструкция прилагается.",
  },
];

const buildFaq = (autofillOn) => [
  {
    q: "Чем это отличается от услуги «под ключ»?",
    a: "Здесь вы заполняете анкету сами, а документы формируются автоматически — поэтому дешевле и мгновенно. В услуге «под ключ» наши специалисты всё делают за вас.",
  },
  ...(autofillOn
    ? [
        {
          q: "Можно не вводить данные вручную, а загрузить документы?",
          a: "Да. На шаге «Доходы» загрузите фото или PDF — справку о доходах (2-НДФЛ), паспорт, договор, справки об оплате лечения или обучения. Сервис распознает документы и заполнит пустые поля анкеты; то, что вы ввели сами, не изменится. Файлы передаются по защищённому каналу и нигде не сохраняются.",
        },
      ]
    : []),
  {
    q: "Мои паспортные данные куда-то отправляются?",
    a: autofillOn
      ? "При ручном заполнении — никуда: документы формируются прямо в вашем браузере, паспорт и суммы не покидают ваше устройство. Если вы воспользуетесь автозаполнением по фото, файлы уйдут на сервер распознавания по защищённому каналу, будут распознаны и сразу удалены — мы их нигде не храним. Автозаполнение необязательно: анкету всегда можно заполнить вручную."
      : "Нет. Документы формируются прямо в вашем браузере: паспорт, доходы и суммы не покидают ваше устройство и не сохраняются на наших серверах.",
  },
  {
    q: "Что я получу после оплаты?",
    a: "Три файла: декларацию 3-НДФЛ (PDF), файл для загрузки в Личный кабинет ФНС (XML) и заявление на возврат налога. Их можно скачать или отправить себе в мессенджер и на почту.",
  },
  {
    q: "Можно объединить несколько вычетов?",
    a: "Да, и нужно: за один год подаётся одна декларация. Выберите в анкете все ситуации — квартира, лечение, обучение, ИИС — они попадут в один документ.",
  },
  {
    q: "За какие годы можно вернуть налог?",
    a: "За три последних года. За каждый год подаётся отдельная декларация — год выбирается на первом шаге анкеты, а лимиты вычетов для него мастер подставит сам.",
  },
  {
    q: "А если налоговая не примет декларацию?",
    a: "Файл для Личного кабинета проверяется по официальным XSD-схемам ФНС ещё до выдачи, поэтому такое случается крайне редко. Если ФНС всё же не примет документы из-за ошибки сервиса — исправим бесплатно или вернём 199 ₽: напишите нам в Telegram.",
  },
  {
    q: "А если я запутаюсь?",
    a: "У каждого поля есть подсказка, где взять цифру. Если всё же сложно — закажите услугу «под ключ», и мы всё сделаем за вас.",
  },
];

export default function SelfService() {
  const autofillOn = useFeatureFlag("doc_autofill");
  const HOW = buildHow(autofillOn);
  const WIZARD_FAQ = buildFaq(autofillOn);

  // Переход из шапки авто-вычета на пункт-секцию («Виды вычетов», «Как
  // работаем») с другой страницы раздела: прокручиваем к нужной секции
  // после загрузки лендинга (id передан в state роутера).
  const { state } = useLocation();
  useEffect(() => {
    const id = state?.scrollTo;
    if (!id) return;
    // rAF ×2: даём Layout выполнить свой scrollTo(0,0) и странице отрендериться.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      })
    );
  }, [state]);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: selfService.name,
      description: selfService.description,
      provider: { "@type": "Organization", name: company.brand, url: company.site },
      offers: {
        "@type": "Offer",
        price: String(selfService.price),
        priceCurrency: "RUB",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: WIZARD_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <Seo
        title={`Заполнить 3-НДФЛ онлайн самому за ${fmtRub(selfService.price)} | Налог-сервис`}
        description={`Декларация 3-НДФЛ онлайн за 15 минут: анкета с подсказками, автоматический расчёт вычета, файл для Личного кабинета ФНС и заявление на возврат. Фиксированная цена ${fmtRub(selfService.price)}.`}
        path="/deklaraciya"
        jsonLd={jsonLd}
      />

      {/* HERO */}
      <section className="hero">
        <div className="hero__inner container">
          <div>
            {/* Промо фичи — в eyebrow (свап одной строки, вёрстка не прыгает):
                4-й буллет доверия не влезал в две строки и ронял hero ниже. */}
            <span className="eyebrow hero__eyebrow">
              {/* Без «Онлайн» в ON-варианте: строка равна OFF по длине и не
                  переносится на мобильном (иначе eyebrow прыгал на 21px). */}
              {autofillOn
                ? `Автозаполнение по фото · ${fmtRub(selfService.price)}`
                : `Онлайн · Автоматически · ${fmtRub(selfService.price)}`}
            </span>
            <h1 className="hero__title hero__title--long">
              Просто заполните данные за 10 минут и{" "}
              <span className="hero__accent">3-НДФЛ</span> сформируется
              автоматически
            </h1>
            <p className="hero__subtitle">
              Отвечаете на простые вопросы — получаете готовую декларацию, файл
              для Личного кабинета ФНС и заявление на возврат. Без ожидания и
              без процентов от вычета.
            </p>
            <div className="hero__actions">
              <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
                Начать заполнение
              </Link>
              <Link to="/deklaraciya/tarify" className="btn btn--light btn--lg">
                Лучше сделайте за меня
              </Link>
            </div>
            <div className="hero__trust">
              <span>⚡ Документы сразу после оплаты</span>
              {/* «Не покидают браузер» — правда только для ручного пути;
                  с автозаполнением честная формулировка — «не сохраняются». */}
              <span>
                {autofillOn
                  ? "🔒 Данные нигде не сохраняются"
                  : "🔒 Данные не покидают ваш браузер"}
              </span>
              <span>💾 Черновик хранится только на вашем устройстве</span>
            </div>
          </div>
          <div className="hero__card">
            <h3>Что вы получите</h3>
            <p>📄 Декларация 3-НДФЛ (PDF) — со всеми листами и расчётом</p>
            <p>💻 Файл для Личного кабинета ФНС — подача онлайн без очередей</p>
            <p>✍️ Заявление на возврат налога — деньги придут на ваш счёт</p>
            {/* Свап текста, а не добавление строки: 7-я строка сделала бы
                карточку выше и сдвинула сетку hero после ответа флага. */}
            <p>
              {autofillOn
                ? "📷 Автозаполнение по фото документов и подсказки к каждому полю"
                : "💬 Подсказки и консультация на каждом шагу"}
            </p>
            <p>🤝 Помощь в случае вопросов от ФНС</p>
            <p>
              <strong>Цена — {fmtRub(selfService.price)}</strong>, фиксированная
            </p>
          </div>
        </div>
      </section>

      {/* Какие вычеты */}
      <section className="section" id="sd-vychety">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Подходит для</span>
            <h2 className="section__title">Какие вычеты можно оформить</h2>
            <p className="section__subtitle">
              Несколько ситуаций за один год объединяются в одну декларацию —
              выберите их в анкете галочками.
            </p>
          </div>
          {/* Плашки кликабельны: анкета открывается с уже выбранным вычетом */}
          <div className="sd-grid">
            {wizardDeductions.map((d) => (
              <Link
                className="sd-tile"
                key={d.slug}
                to="/deklaraciya/anketa"
                state={{ deduction: d.slug }}
              >
                <span className="sd-tile__icon" aria-hidden="true">
                  {d.icon}
                </span>
                <span className="sd-tile__body">
                  <span className="sd-tile__title">{d.title}</span>
                  <span className="sd-tile__text">{d.short}</span>
                  <span className="sd-tile__foot">
                    <span className="sd-tile__limit">{d.limit}</span>
                    <span className="sd-tile__go">Выбрать →</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="section section--muted" id="sd-kak-rabotaem">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Как это работает</span>
            <h2 className="section__title">4 шага — и документы у вас</h2>
          </div>
          <div className="steps">
            {HOW.map((s) => (
              <div className="step" key={s.num}>
                <div className="step__num">{s.num}</div>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Демо документов: реальный выхлоп генератора на вымышленных данных —
          самое честное социальное доказательство, пока нет отзывов. */}
      <section className="section" id="sd-dokumenty">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Что вы получите</span>
            <h2 className="section__title">Так выглядят ваши документы</h2>
            <p className="section__subtitle">
              Декларация печатается на официальном бланке ФНС — как из
              программы налоговой. Данные на образцах вымышленные.
            </p>
          </div>
          <div className="docsdemo">
            <figure className="docsdemo__item card">
              <div className="docsdemo__imgwrap">
                <img
                  src={`${import.meta.env.BASE_URL}demo-decl.webp`}
                  alt="Декларация 3-НДФЛ — титульный лист на официальном бланке ФНС"
                  loading="lazy"
                  width="700"
                  height="990"
                />
                <span className="docsdemo__badge">Образец</span>
              </div>
              <figcaption>
                <strong>Декларация 3-НДФЛ (PDF)</strong>
                <span>Официальный бланк, все листы и расчёт вычета</span>
              </figcaption>
            </figure>
            <figure className="docsdemo__item card">
              <div className="docsdemo__imgwrap">
                <img
                  src={`${import.meta.env.BASE_URL}demo-zayav.webp`}
                  alt="Заявление на возврат налога — образец"
                  loading="lazy"
                  width="700"
                  height="990"
                />
                <span className="docsdemo__badge">Образец</span>
              </div>
              <figcaption>
                <strong>Заявление на возврат налога</strong>
                <span>Деньги придут на ваш счёт после проверки</span>
              </figcaption>
            </figure>
            <figure className="docsdemo__item card">
              <div className="docsdemo__imgwrap docsdemo__imgwrap--code" aria-hidden="true">
                <pre>{`<?xml version="1.0"
  encoding="windows-1251"?>
<Файл ИдФайл="NO_NDFL3_7447_…"
  ВерсФорм="5.03">
  <Документ КНД="1151020"
    ОтчетГод="2025"
    … />
</Файл>`}</pre>
              </div>
              <figcaption>
                <strong>Файл для Личного кабинета ФНС</strong>
                <span>
                  ✅ Проверяется по официальным XSD-схемам ФНС — кабинет примет
                  его как «готовую декларацию»
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* АПСЕЛЛ: лестница вверх — «сделаем за вас» вместо самозаполнения */}
      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Не хочется разбираться самому?</span>
            <h2 className="section__title">Сделаем всё за вас — от 990 ₽</h2>
            <p className="section__subtitle">
              Специалист подготовит декларацию по вашим документам, проверит
              каждую цифру и подскажет, как подать. Оплата — только по факту
              готовности документов.
            </p>
          </div>
          <div className="section__head" style={{ margin: "0 auto" }}>
            <Link to="/deklaraciya/tarify" className="btn btn--primary btn--lg">
              Посмотреть тарифы «под ключ»
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Вопросы</span>
            <h2 className="section__title">Частые вопросы</h2>
          </div>
          <Faq items={WIZARD_FAQ} />
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Верните свои 13% уже в этом году</h2>
          <p className="cta__text">
            Средний вычет наших клиентов — больше 50 000 ₽. Анкета займёт 15
            минут, черновик сохраняется автоматически.
          </p>
          <div className="cta__actions">
            <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
              Начать заполнение — {fmtRub(selfService.price)}
            </Link>
            <a href={company.telegram} className="btn btn--light btn--lg">
              Спросить в Telegram
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
