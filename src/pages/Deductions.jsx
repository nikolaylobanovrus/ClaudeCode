import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { deductions } from "../data/content.js";

export default function Deductions() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: deductions.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.title,
      description: d.text,
    })),
  };

  return (
    <>
      <Seo
        title="Виды налоговых вычетов — за что можно вернуть НДФЛ | Налог-сервис"
        description="Имущественный вычет за квартиру и ипотеку, социальные вычеты за лечение и обучение, вычет по ИИС и страхованию жизни. Узнайте, сколько можно вернуть, и оформите вычет под ключ."
        path="/vychety"
        jsonLd={jsonLd}
      />
      <PageHero
        eyebrow="Виды вычетов"
        title="За что можно вернуть налог"
        subtitle="Государство возвращает 13% НДФЛ с ваших расходов. Мы подготовим декларацию 3-НДФЛ по любой из ситуаций."
        crumbs={["Виды вычетов"]}
      />

      <section className="section">
        <div className="container">
          <div className="deduction-grid">
            {deductions.map((d) => (
              <article className="deduction" key={d.slug}>
                <div className="deduction__icon" aria-hidden="true">
                  {d.icon}
                </div>
                <h2 className="deduction__title">{d.title}</h2>
                <p className="deduction__text">{d.text}</p>
                <span className="deduction__limit">Вернём {d.limit}</span>
                <Link to="/kontakty" className="deduction__link">
                  Оформить вычет →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Не нашли свою ситуацию?</h2>
          <p className="cta__text">
            Задайте вопрос эксперту — бесплатно проконсультируем и подскажем, на
            какой вычет вы имеете право.
          </p>
          <Link to="/kontakty" className="btn btn--green btn--lg">
            Получить консультацию
          </Link>
        </div>
      </section>
    </>
  );
}
