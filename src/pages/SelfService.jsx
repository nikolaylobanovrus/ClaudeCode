// Лендинг услуги «Заполнить декларацию самому»: отдельная точка входа для
// рекламы (Авито, директ) — свой оффер, цена и CTA, дизайн — общий с сайтом.
// Сам мастер — на /deklaraciya/anketa.
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Faq from "../components/Faq.jsx";
import { company, selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";
import { wizardDeductions } from "../data/wizard.js";

const HOW = [
  {
    num: "1",
    title: "Отвечаете на вопросы",
    text: "Простая анкета с подсказками «где взять цифру»: справка о доходах, договор, чеки. 10–15 минут.",
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
    title: "Подаёте онлайн",
    text: "Загружаете файл в Личный кабинет ФНС — и ждёте деньги на счёт. Инструкция прилагается.",
  },
];

const WIZARD_FAQ = [
  {
    q: "Чем это отличается от услуги «под ключ»?",
    a: "Здесь вы заполняете анкету сами, а документы формируются автоматически — поэтому дешевле и мгновенно. В услуге «под ключ» наши специалисты всё делают за вас.",
  },
  {
    q: "Мои паспортные данные куда-то отправляются?",
    a: "Нет. Документы формируются прямо в вашем браузере: паспорт, доходы и суммы не покидают ваше устройство и не сохраняются на наших серверах.",
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
    q: "А если я запутаюсь?",
    a: "У каждого поля есть подсказка, где взять цифру. Если всё же сложно — закажите услугу «под ключ», и мы всё сделаем за вас.",
  },
];

export default function SelfService() {
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
            <span className="eyebrow hero__eyebrow">
              Онлайн · Автоматически · {fmtRub(selfService.price)}
            </span>
            <h1 className="hero__title">
              Заполните <span className="hero__accent">3-НДФЛ сами</span> за 15
              минут — мы всё посчитаем
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
              <Link to="/tarify" className="btn btn--light btn--lg">
                Лучше сделайте за меня
              </Link>
            </div>
            <div className="hero__trust">
              <span>⚡ Документы сразу после оплаты</span>
              <span>🔒 Данные не покидают ваш браузер</span>
              <span>💾 Черновик сохраняется</span>
            </div>
          </div>
          <div className="hero__card">
            <h3>Что вы получите</h3>
            <p>📄 Декларация 3-НДФЛ (PDF) — со всеми листами и расчётом</p>
            <p>💻 Файл для Личного кабинета ФНС — подача онлайн без очередей</p>
            <p>✍️ Заявление на возврат налога — деньги придут на ваш счёт</p>
            <p>
              <strong>Цена — {fmtRub(selfService.price)}</strong>, фиксированная
            </p>
          </div>
        </div>
      </section>

      {/* Какие вычеты */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Подходит для</span>
            <h2 className="section__title">Какие вычеты можно оформить</h2>
            <p className="section__subtitle">
              Несколько ситуаций за один год объединяются в одну декларацию —
              выберете их в анкете галочками.
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
      <section className="section section--muted">
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
            <Link to="/tarify" className="btn btn--primary btn--lg">
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
