import PageHero from "../components/PageHero.jsx";
import { stats } from "../data/content.js";

const values = [
  {
    title: "Честность",
    text: "Говорим прямо о сроках, рисках и стоимости. Без сюрпризов в конце.",
  },
  {
    title: "Качество",
    text: "Пишем код, который приятно поддерживать, и дизайн, которым приятно пользоваться.",
  },
  {
    title: "Партнёрство",
    text: "Погружаемся в задачу клиента как в свою и играем в долгую.",
  },
];

export default function About() {
  return (
    <>
      <PageHero
        eyebrow="О студии"
        title="Маленькая команда с большими амбициями"
        subtitle="Мы верим, что хорошие продукты рождаются на стыке дизайна, инженерии и заботы о пользователе."
      />

      <section className="section">
        <div className="container prose">
          <p>
            Nebula Studio появилась в 2018 году как команда друзей, уставших от
            медленных и запутанных интерфейсов. С тех пор мы выросли, но принцип
            остался прежним: делать просто, быстро и красиво.
          </p>
          <p>
            Мы работаем с фаундерами стартапов и продуктовыми командами крупных
            компаний, помогая им проверять гипотезы и запускать то, что нужно
            пользователям.
          </p>
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <dl className="stats-grid">
            {stats.map((s) => (
              <div key={s.label} className="stats-grid__item">
                <dt>{s.value}</dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Наши ценности</span>
            <h2 className="section__title">Во что мы верим</h2>
          </div>
          <div className="cards">
            {values.map((v) => (
              <article key={v.title} className="card">
                <h3 className="card__title">{v.title}</h3>
                <p className="card__text">{v.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
