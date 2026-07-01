import { Link } from "react-router-dom";
import { services, projects, stats } from "../data/content.js";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero__inner">
          <span className="eyebrow">Студия цифровых продуктов</span>
          <h1 className="hero__title">
            Придумываем, проектируем и запускаем{" "}
            <span className="hero__accent">продукты, которыми пользуются</span>
          </h1>
          <p className="hero__subtitle">
            Nebula Studio — небольшая команда дизайнеров и инженеров. Превращаем
            идеи в быстрые и красивые веб-приложения на React.
          </p>
          <div className="hero__actions">
            <Link to="/contact" className="btn btn--primary btn--lg">
              Обсудить проект
            </Link>
            <Link to="/work" className="btn btn--ghost btn--lg">
              Наши работы
            </Link>
          </div>

          <dl className="hero__stats">
            {stats.map((s) => (
              <div key={s.label} className="hero__stat">
                <dt>{s.value}</dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Услуги */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Что мы делаем</span>
            <h2 className="section__title">Полный цикл — от идеи до релиза</h2>
          </div>
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
          <div className="section__foot">
            <Link to="/services" className="link-arrow">
              Все услуги →
            </Link>
          </div>
        </div>
      </section>

      {/* Избранные проекты */}
      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Избранное</span>
            <h2 className="section__title">Недавние проекты</h2>
          </div>
          <div className="work-grid">
            {projects.slice(0, 2).map((p) => (
              <article key={p.title} className="work-card">
                <div
                  className="work-card__preview"
                  style={{ background: p.accent }}
                >
                  <span>{p.title}</span>
                </div>
                <div className="work-card__body">
                  <span className="work-card__cat">{p.category}</span>
                  <p>{p.description}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="section__foot">
            <Link to="/work" className="link-arrow">
              Смотреть все работы →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container cta__inner">
          <h2 className="cta__title">Есть идея продукта?</h2>
          <p className="cta__text">
            Расскажите о задаче — вернёмся с планом и оценкой в течение двух дней.
          </p>
          <Link to="/contact" className="btn btn--primary btn--lg">
            Начать проект
          </Link>
        </div>
      </section>
    </>
  );
}
