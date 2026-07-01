import { Link } from "react-router-dom";
import PageHero from "../components/PageHero.jsx";
import { services, steps } from "../data/content.js";

export default function Services() {
  return (
    <>
      <PageHero
        eyebrow="Услуги"
        title="Помогаем на каждом этапе продукта"
        subtitle="Берём проект целиком или подключаемся к вашей команде на конкретном этапе."
      />

      <section className="section">
        <div className="container">
          <div className="cards">
            {services.map((s) => (
              <article key={s.title} className="card">
                <div className="card__icon" aria-hidden="true">
                  {s.icon}
                </div>
                <h3 className="card__title">{s.title}</h3>
                <p className="card__text">{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Как мы работаем</span>
            <h2 className="section__title">Четыре понятных шага</h2>
          </div>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step.num} className="step">
                <span className="step__num">{step.num}</span>
                <div>
                  <h3 className="step__title">{step.title}</h3>
                  <p className="step__text">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cta">
        <div className="container cta__inner">
          <h2 className="cta__title">Нужна помощь с продуктом?</h2>
          <p className="cta__text">
            Опишите задачу — предложим подходящий формат сотрудничества.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg">
            Связаться с нами
          </Link>
        </div>
      </section>
    </>
  );
}
