import PageHero from "../components/PageHero.jsx";
import { projects } from "../data/content.js";

export default function Work() {
  return (
    <>
      <PageHero
        eyebrow="Работы"
        title="Проекты, которыми гордимся"
        subtitle="Небольшая выборка из того, что мы спроектировали и запустили."
      />

      <section className="section">
        <div className="container">
          <div className="work-grid">
            {projects.map((p) => (
              <article key={p.title} className="work-card">
                <div
                  className="work-card__preview"
                  style={{ background: p.accent }}
                >
                  <span>{p.title}</span>
                </div>
                <div className="work-card__body">
                  <span className="work-card__cat">{p.category}</span>
                  <h3 className="work-card__title">{p.title}</h3>
                  <p>{p.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
