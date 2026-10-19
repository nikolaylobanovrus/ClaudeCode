// Оглавление разборов (/deklaraciya/stati).
//
// Зачем страница. В подвале висели ссылки на все 29 разборов — владелец
// справедливо сказал, что это громоздко (19.10.2026). Выкинуть их было
// нельзя: у части статей это единственные входящие ссылки, без которых
// поиск страницу не найдёт. Хаб решает обе задачи сразу — в подвале одна
// ссылка, а входящие у статей остаются.
//
// Для поиска это не потеря, а выигрыш: сквозные ссылки в подвале поисковики
// считают шаблонными и ценят ниже, чем ссылку со страницы по теме. Плюс сам
// хаб отвечает на запросы вида «налоговые вычеты статьи» и «какие вычеты
// бывают».
//
// Список берём из src/data/articles.js — он же питает подвал. Одна правка,
// а не три, и новая статья не может остаться без ссылки.
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { NoBreak } from "../lib/nowrap.jsx";
import { ARTICLE_GROUPS, ALL_ARTICLES } from "../data/articles.js";
import { selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";

export default function SelfServiceStati() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Полезные статьи о налоговых вычетах",
      hasPart: ALL_ARTICLES.map((a) => ({
        "@type": "Article",
        headline: a.title,
        url: "https://налог-сервис.рф" + a.to,
        description: a.text,
      })),
    },
  ];

  return (
    // Через NoBreak: «3-НДФЛ» не должно разрываться по дефису (проверка
    // check-hscroll поймала это на 360px).
    <NoBreak>
      <Seo
        title="Полезные статьи о налоговых вычетах и декларации 3-НДФЛ | Налог-сервис"
        description={`${ALL_ARTICLES.length} разборов: вычеты за квартиру, ипотеку, лечение, обучение и детей, налог с продажи имущества, сроки возврата и частые отказы. Простым языком, с лимитами и документами.`}
        path="/deklaraciya/stati"
        jsonLd={jsonLd}
      />

      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Заполнить самому</Link>
            <span>/ Полезные статьи</span>
          </nav>
          <h1 className="page-hero__title">Полезные статьи</h1>
          <p className="page-hero__subtitle">
            {ALL_ARTICLES.length} разборов о вычетах и декларации 3-НДФЛ: сколько
            вернут, какие документы нужны и чего делать не стоит. Все цифры —
            лимиты, сроки и ставки — из действующих правил.
          </p>
          <div className="hero__actions">
            <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
              Заполнить декларацию — {fmtRub(selfService.price)}
            </Link>
          </div>
          <p className="page-hero__note">
            Бесплатно и без регистрации: сумма к возврату видна до оплаты.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container instr">
          {ARTICLE_GROUPS.map((group) => (
            <article className="card instr__block" key={group.title}>
              <h2>{group.title}</h2>
              <p>{group.note}</p>
              <ul className="stati__list">
                {group.items.map((a) => (
                  <li key={a.to}>
                    <Link to={a.to}>{a.title}</Link>
                    <span>{a.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Нашли свою ситуацию?</h2>
          <p className="cta__text">
            Анкета посчитает возврат по ходу заполнения — сумма видна до оплаты.
            Готовый комплект: 3-НДФЛ в PDF, XML для Личного кабинета ФНС и
            заявление на возврат за {fmtRub(selfService.price)}.
          </p>
          <div className="cta__actions">
            <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
              Заполнить декларацию
            </Link>
            <Link to="/deklaraciya/kalkulyator-naloga-s-prodazhi" className="btn btn--light btn--lg">
              Посчитать налог с продажи
            </Link>
          </div>
        </div>
      </section>
    </NoBreak>
  );
}
