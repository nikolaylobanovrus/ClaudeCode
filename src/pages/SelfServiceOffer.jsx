// Оферта сервиса самостоятельного заполнения (/deklaraciya/oferta):
// отдельный документ для авто-вычета за 199 ₽ — у клиентов «под ключ»
// своя оферта на /publichnaya-oferta, условия не смешиваются.
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { selfServiceOffer as offer } from "../data/legal.js";

export default function SelfServiceOffer() {
  return (
    <>
      <Seo
        title="Публичная оферта сервиса самостоятельного заполнения | Налог-сервис"
        description="Договор оказания услуг (публичная оферта) ООО «Информкарт»: сервис самостоятельного заполнения налоговой декларации 3-НДФЛ за 199 ₽."
        path="/deklaraciya/oferta"
        noindex
      />

      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Заполнить самому</Link>
            <span>/ Оферта</span>
          </nav>
          <h1 className="page-hero__title">Публичная оферта</h1>
          <p className="page-hero__subtitle">{offer.subtitle}</p>
        </div>
      </section>

      <section className="section">
        <div className="container prose">
          <p style={{ color: "var(--ink-500)" }}>{offer.date}</p>

          {offer.intro.map((p, i) => (
            <p key={`i${i}`}>{p}</p>
          ))}

          <h2>Предмет и условия договора</h2>
          {offer.clauses.map((c, i) => (
            <p key={`c${i}`}>{c}</p>
          ))}

          <h2>Реквизиты Исполнителя</h2>
          <div className="legal-approve">
            {offer.requisites.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
