import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Calculator from "../components/Calculator.jsx";
import LeadForm from "../components/LeadForm.jsx";
import Faq from "../components/Faq.jsx";
import {
  company,
  deductions,
  steps,
  advantages,
  tariffs,
  reviews,
  team,
  stats,
} from "../data/content.js";
import { faq } from "../data/faq.jsx";

const initials = (name) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

export default function Home() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "Налог-сервис",
      description:
        "Возврат налоговых вычетов (НДФЛ) под ключ: имущественный, за лечение, обучение, ИИС. Оплата за результат.",
      url: company.site,
      telephone: company.phoneRaw,
      email: company.email,
      priceRange: "от 990 ₽",
      areaServed: "RU",
      address: {
        "@type": "PostalAddress",
        addressCountry: "RU",
        addressRegion: "Челябинская область",
        streetAddress: "п. Тимирязевский, ул. Чайковского, д. 11",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "128",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.aText || f.a },
      })),
    },
  ];

  return (
    <>
      <Seo
        title="Налоговый вычет под ключ — вернём НДФЛ за вас | Налог-сервис"
        description="Поможем вернуть налоговый вычет (НДФЛ) быстро и без очередей: имущественный, за лечение, обучение, ИИС. Оплата за результат, официальный договор. Бесплатная консультация по телефону."
        path="/"
        jsonLd={jsonLd}
      />

      {/* HERO */}
      <section className="hero">
        <div className="hero__inner container">
          <div>
            <span className="eyebrow hero__eyebrow">
              Официально · Оплата за результат
            </span>
            <h1 className="hero__title">
              Получите <span className="hero__accent">налоговый вычет</span> без
              очередей и ошибок
            </h1>
            <p className="hero__subtitle">
              Оставьте заявку онлайн — подготовим декларацию 3-НДФЛ и вернём ваши
              деньги. Гарантия качества услуг, оплата только по факту готовности
              документов.
            </p>
            <div className="hero__actions">
              <Link to="/registraciya" className="btn btn--green btn--lg">
                Сформировать декларацию онлайн
              </Link>
              <a href={`tel:${company.phoneRaw}`} className="btn btn--light btn--lg">
                {company.phone}
              </a>
            </div>
            <div className="hero__trust">
              <span>✅ Гарантия качества</span>
              <span>💳 Оплата по факту</span>
              <span>🔒 Конфиденциально</span>
            </div>
          </div>

          <div className="hero__card">
            <LeadForm compact title="Бесплатная консультация" />
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="container">
        <div className="stats">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat__value">{s.value}</div>
              <div className="stat__label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DEDUCTIONS */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Виды вычетов</span>
            <h2 className="section__title">Выберите свою ситуацию</h2>
            <p className="section__subtitle">
              Вернём 13% с ваших расходов — вне зависимости от того, за что вы
              имеете право на вычет.
            </p>
          </div>
          <div className="deduction-grid">
            {deductions.map((d) => (
              <article className="deduction" key={d.slug}>
                <div className="deduction__icon" aria-hidden="true">
                  {d.icon}
                </div>
                <h3 className="deduction__title">{d.title}</h3>
                <p className="deduction__text">{d.short}</p>
                <span className="deduction__limit">{d.limit}</span>
                <Link to="/vychety" className="deduction__link">
                  Подробнее →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Калькулятор</span>
            <h2 className="section__title">Сколько вы можете вернуть?</h2>
            <p className="section__subtitle">
              Посчитайте сумму вычета за пару секунд — а мы поможем её получить.
            </p>
          </div>
          <Calculator />
        </div>
      </section>

      {/* STEPS */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Как это работает</span>
            <h2 className="section__title">4 шага, чтобы получить вычет</h2>
          </div>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.num}>
                <div className="step__num">{s.num}</div>
                <span className="step__who">{s.who}</span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__text">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="section__head" style={{ margin: "40px auto 0" }}>
            <Link to="/kontakty" className="btn btn--primary btn--lg">
              Начать — оставить заявку
            </Link>
          </div>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Почему нам доверяют</span>
            <h2 className="section__title">С нами вернёте больше и быстрее</h2>
          </div>
          <div className="cards">
            {advantages.map((a) => (
              <article className="card" key={a.title}>
                <div className="card__icon" aria-hidden="true">
                  {a.icon}
                </div>
                <h3 className="card__title">{a.title}</h3>
                <p className="card__text">{a.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TARIFFS */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Тарифы</span>
            <h2 className="section__title">Выберите удобный тариф</h2>
            <p className="section__subtitle">
              Оплата после подготовки ваших документов. Цены указаны с учётом
              скидки 10%.
            </p>
          </div>
          <div className="tariffs">
            {tariffs.map((t) => (
              <div className={"tariff" + (t.highlight ? " tariff--hot" : "")} key={t.name}>
                {t.highlight && <div className="tariff__badge">Хит продаж</div>}
                <div className="tariff__name">{t.name}</div>
                <div className="tariff__caption">{t.caption}</div>
                <div className="tariff__price">
                  {t.price}{" "}
                  {t.oldPrice && <span className="tariff__old">{t.oldPrice}</span>}
                </div>
                <div className="tariff__term">Срок — {t.term}</div>
                <ul className="tariff__features">
                  {t.features.map((f) => (
                    <li key={f}>
                      <span className="tariff__check">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/kontakty"
                  className={"btn btn--block " + (t.highlight ? "btn--primary" : "btn--ghost")}
                >
                  Заказать
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Отзывы</span>
            <h2 className="section__title">Что клиенты говорят о нас</h2>
          </div>
          <div className="reviews">
            {reviews.map((r) => (
              <article className="review" key={r.name}>
                <div className="review__stars" aria-label="5 из 5">
                  ★★★★★
                </div>
                <p className="review__text">{r.text}</p>
                <div className="review__author">
                  <div className="review__avatar" aria-hidden="true">
                    {initials(r.name)}
                  </div>
                  <div>
                    <div className="review__name">{r.name}</div>
                    <div className="review__date">{r.date}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Наша команда</span>
            <h2 className="section__title">Доверьте документы экспертам</h2>
          </div>
          <div className="team">
            {team.map((m) => (
              <div className="team__card" key={m.name}>
                <div className="team__avatar" aria-hidden="true">
                  {initials(m.name)}
                </div>
                <div className="team__name">{m.name}</div>
                <div className="team__role">{m.role}</div>
                <div className="team__exp">Опыт: {m.exp}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Вопросы и ответы</span>
            <h2 className="section__title">Часто задаваемые вопросы</h2>
          </div>
          <Faq items={faq} />
        </div>
      </section>

      {/* LEAD */}
      <section className="section">
        <div className="container">
          <div className="lead">
            <div>
              <span className="eyebrow">Бесплатно</span>
              <h2 className="section__title" style={{ textAlign: "left" }}>
                Получите бесплатную консультацию
              </h2>
              <ul className="lead__list">
                <li>
                  <span className="lead__check">✓</span> Ответим на ваши вопросы и
                  подберём вычеты
                </li>
                <li>
                  <span className="lead__check">✓</span> Сформируем список
                  документов
                </li>
                <li>
                  <span className="lead__check">✓</span> Рассчитаем сумму к
                  возврату
                </li>
              </ul>
            </div>
            <div>
              <LeadForm />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Готовы вернуть свои деньги?</h2>
          <p className="cta__text">
            Сформируйте декларацию онлайн или оставьте заявку — эксперт свяжется
            с вами и рассчитает сумму вычета.
          </p>
          <div className="cta__actions">
            <Link to="/registraciya" className="btn btn--green btn--lg">
              Сформировать декларацию онлайн
            </Link>
            <Link to="/kontakty" className="btn btn--light btn--lg">
              Оставить заявку
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
