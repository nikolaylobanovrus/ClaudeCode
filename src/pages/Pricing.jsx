import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { tariffs } from "../data/content.js";
import { faq } from "../data/faq.jsx";
import Faq from "../components/Faq.jsx";

export default function Pricing() {
  // «Сам онлайн» (199 ₽) намеренно не показывается на странице тарифов:
  // сервис самозаполнения рекламируется отдельным лендингом /deklaraciya,
  // чтобы не перетягивать клиентов основных тарифов (решение владельца).
  const jsonLd = [
    ...tariffs.map((t) => ({
      "@context": "https://schema.org",
      "@type": "Offer",
      name: `Тариф «${t.name}»`,
      price: t.price.replace(/\D/g, ""),
      priceCurrency: "RUB",
      description: t.features.join(", "),
      availability: "https://schema.org/InStock",
    })),
  ];

  return (
    <>
      <Seo
        title="Тарифы и цены на подготовку декларации 3-НДФЛ | Налог-сервис"
        description="Стоимость подготовки декларации 3-НДФЛ под ключ — тарифы «Базовый», «Оптимальный» и «Премиум». Оплата по факту готовности документов, гарантия качества."
        path="/tarify"
        jsonLd={jsonLd}
      />
      <PageHero
        eyebrow="Тарифы"
        title="Честные цены — оплата за результат"
        subtitle="Берём оплату только по факту готовности документов. Цены указаны с учётом скидки 10%."
        crumbs={["Тарифы"]}
      />

      <section className="section">
        <div className="container">
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

      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Оплата</span>
            <h2 className="section__title">Как и когда оплачивать</h2>
          </div>
          <Faq items={faq.slice(2, 4)} />
        </div>
      </section>

      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Готовы оформить вычет?</h2>
          <p className="cta__text">
            Сформируйте декларацию онлайн или оставьте заявку — рассчитаем
            стоимость и сумму к возврату именно для вашей ситуации.
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
