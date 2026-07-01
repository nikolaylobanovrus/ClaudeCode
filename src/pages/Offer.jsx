import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { publicOffer } from "../data/legal.js";

export default function Offer() {
  return (
    <>
      <Seo
        title="Публичная оферта | Налог-сервис"
        description="Договор оказания услуг (публичная оферта) ООО «Информкарт» по составлению налоговой декларации по налогу на доходы физических лиц (форма 3-НДФЛ)."
        path="/publichnaya-oferta"
        noindex
      />
      <PageHero
        title="Публичная оферта"
        subtitle={publicOffer.subtitle}
        crumbs={["Публичная оферта"]}
      />

      <section className="section">
        <div className="container prose">
          <p style={{ color: "var(--ink-500)" }}>{publicOffer.date}</p>

          {publicOffer.intro.map((p, i) => (
            <p key={`i${i}`}>{p}</p>
          ))}

          <ul className="dashed">
            {publicOffer.acceptance.map((li, i) => (
              <li key={i}>{li}</li>
            ))}
          </ul>

          <p>{publicOffer.afterAcceptance}</p>

          <h2>Предмет и условия договора</h2>
          {publicOffer.clauses.map((c, i) => (
            <p key={`c${i}`}>{c}</p>
          ))}

          <h2>Реквизиты Исполнителя</h2>
          <div className="legal-approve">
            {publicOffer.requisites.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>

          <h2>{publicOffer.appendix.title}</h2>
          <p>{publicOffer.appendix.note}</p>
          <table className="legal-table">
            <thead>
              <tr>
                <th>Наименование тарифа</th>
                <th>Срок оказания услуги</th>
                <th>Размер вознаграждения</th>
              </tr>
            </thead>
            <tbody>
              {publicOffer.appendix.rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.term}</td>
                  <td>{r.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
