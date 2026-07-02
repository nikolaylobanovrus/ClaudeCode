import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { company } from "../data/content.js";

export default function Contacts() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.legalName,
    legalName: company.legalName,
    url: company.site,
    email: company.email,
    telephone: company.phoneRaw,
    address: {
      "@type": "PostalAddress",
      streetAddress: "п. Тимирязевский, ул. Чайковского, д. 11",
      addressRegion: "Челябинская область",
      postalCode: "456404",
      addressCountry: "RU",
    },
    identifier: [
      { "@type": "PropertyValue", name: "ИНН", value: company.inn },
      { "@type": "PropertyValue", name: "ОГРН", value: company.ogrn },
    ],
  };

  return (
    <>
      <Seo
        title="Контакты — Налог-сервис | Возврат налогового вычета"
        description="Свяжитесь с Налог-сервис: телефон +7 (920) 837-91-93, электронная почта, мессенджеры WhatsApp, Telegram, Max. Колл-центр 24/7. Оставьте заявку онлайн."
        path="/kontakty"
        jsonLd={jsonLd}
      />
      <PageHero
        eyebrow="Контакты"
        title="Свяжитесь с нами"
        subtitle="Ответим на вопросы, подберём вычеты и рассчитаем сумму к возврату. Консультация бесплатна."
        crumbs={["Контакты"]}
      />

      <section className="section">
        <div className="container">
          <div className="lead">
            <div>
              <h2 style={{ fontSize: 22, marginBottom: 16 }}>Наши контакты</h2>
              <ul className="lead__list">
                <li>
                  <span className="lead__check">📞</span>
                  <span>
                    Колл-центр 24/7:{" "}
                    <a href={`tel:${company.phoneRaw}`} style={{ color: "var(--blue-700)", fontWeight: 700 }}>
                      {company.phone}
                    </a>
                    {", "}
                    <a href={`tel:${company.phone2Raw}`} style={{ color: "var(--blue-700)", fontWeight: 700 }}>
                      {company.phone2}
                    </a>
                  </span>
                </li>
                <li>
                  <span className="lead__check">✉️</span>
                  <a href={`mailto:${company.email}`} style={{ color: "var(--blue-700)", fontWeight: 700 }}>
                    {company.email.toLowerCase()}
                  </a>
                </li>
                <li>
                  <span className="lead__check">📍</span>
                  <span>{company.address}</span>
                </li>
              </ul>

              <div className="messengers" style={{ marginTop: 20 }}>
                <a className="messenger messenger--wa" href={company.whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <a className="messenger messenger--tg" href={company.telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
                <a
                  className="messenger messenger--max"
                  href={company.max}
                  target="_blank"
                  rel="noreferrer"
                >
                  Max
                </a>
              </div>

              <div className="footer__req" style={{ marginTop: 26, color: "var(--ink-500)" }}>
                <strong>{company.legalName}</strong>
                <br />
                ИНН {company.inn} · КПП {company.kpp} · ОГРН {company.ogrn}
                <br />
                Р/с {company.account}
                <br />
                {company.bank} · БИК {company.bik}
                <br />
                К/с {company.corrAccount}
              </div>
            </div>

            <div>
              <LeadForm title="Оставьте заявку" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
