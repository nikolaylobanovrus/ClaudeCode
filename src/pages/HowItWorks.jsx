import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { steps, advantages } from "../data/content.js";

export default function HowItWorks() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Как получить налоговый вычет с Налог-сервис",
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.text,
    })),
  };

  return (
    <>
      <Seo
        title="Как получить налоговый вычет — 4 шага | Налог-сервис"
        description="Как оформить налоговый вычет через Налог-сервис: оставляете заявку, отправляете документы, мы формируем и подаём декларацию 3-НДФЛ. Деньги приходят на карту в течение 4 месяцев."
        path="/kak-rabotaem"
        jsonLd={jsonLd}
      />
      <PageHero
        eyebrow="Как работаем"
        title="Всего 4 шага до вашего вычета"
        subtitle="Простой и прозрачный процесс — большую часть работы мы берём на себя."
        crumbs={["Как работаем"]}
      />

      <section className="section">
        <div className="container">
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.num}>
                <div className="step__num">{s.num}</div>
                <span className="step__who">{s.who}</span>
                <h2 className="step__title">{s.title}</h2>
                <p className="step__text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Гарантии</span>
            <h2 className="section__title">Почему это безопасно</h2>
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

      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Начнём прямо сейчас?</h2>
          <p className="cta__text">
            Сформируйте декларацию онлайн — или оставьте заявку, и уже сегодня
            получите список документов для вашего вычета.
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
