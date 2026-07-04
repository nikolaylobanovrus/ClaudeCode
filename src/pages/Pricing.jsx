import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { tariffs, selfService } from "../data/content.js";
import { faq } from "../data/faq.jsx";
import Faq from "../components/Faq.jsx";

export default function Pricing() {
  const jsonLd = [
    // Самостоятельное заполнение — тоже оффер, участвует в rich snippets.
    {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: `Тариф «Сам онлайн» — ${selfService.name}`,
      price: String(selfService.price),
      priceCurrency: "RUB",
      description: selfService.description,
      availability: "https://schema.org/InStock",
    },
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
        description="Стоимость подготовки декларации 3-НДФЛ — от 99 ₽: самостоятельное заполнение онлайн или тарифы «Базовый», «Оптимальный» и «Премиум» под ключ. Оплата по факту, гарантия качества."
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
            {/* Самостоятельное заполнение — самый доступный вариант */}
            <div className="tariff">
              <div className="tariff__name">Сам онлайн</div>
              <div className="tariff__caption">Заполняете анкету сами — документы сразу</div>
              <div className="tariff__price">{selfService.price.toLocaleString("ru-RU")} ₽</div>
              <div className="tariff__term">Срок — 15 минут</div>
              <ul className="tariff__features">
                {[
                  "Декларация 3-НДФЛ (PDF)",
                  "Файл для Личного кабинета ФНС",
                  "Заявление на возврат налога",
                  "Подсказки к каждому полю",
                ].map((f) => (
                  <li key={f}>
                    <span className="tariff__check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/deklaraciya" className="btn btn--block btn--ghost">
                Заполнить самому
              </Link>
            </div>
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
