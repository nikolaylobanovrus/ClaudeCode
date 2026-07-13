// Контакты ВНУТРИ раздела «Заполнить самому» (/deklaraciya/kontakty).
// Тот же контент, что и на /kontakty основного сайта, но крошка ведёт назад
// в раздел авто-вычета — клиент, пришедший по рекламе, не «проваливается»
// в основной сайт.
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { company } from "../data/content.js";

export default function SelfServiceContacts() {
  return (
    <>
      <Seo
        title="Контакты — Заполнить декларацию самому | Налог-сервис"
        description="Свяжитесь с Налог-сервис: телефон +7 (920) 837-91-93, электронная почта, мессенджеры Telegram, Max. Оставьте заявку онлайн."
        path="/deklaraciya/kontakty"
        noindex
      />

      {/* Своя шапка: крошка ведёт назад к заполнению самому, а не в основной сайт. */}
      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/deklaraciya">Заполнить самому</Link>
            <span>/ Контакты</span>
          </nav>
          <span className="eyebrow hero__eyebrow">Контакты</span>
          <h1 className="page-hero__title">Свяжитесь с нами</h1>
          <p className="page-hero__subtitle">
            Ответим на вопросы по заполнению, поможем с подачей и при вопросах от
            ФНС. Консультация бесплатна.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="lead">
            <div>
              <h2 style={{ fontSize: 22, marginBottom: 16 }}>Наши контакты</h2>
              <ul className="lead__list">
                <li>
                  <span className="lead__check">📞</span>
                  <span>
                    Телефон:{" "}
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
                <a className="messenger messenger--tg" href={company.telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
                <a className="messenger messenger--max" href={company.max} target="_blank" rel="noreferrer">
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
              <LeadForm title="Оставьте заявку" goal="lead_deklaraciya" />
            </div>
          </div>
        </div>
      </section>

      {/* Возврат к заполнению самому. */}
      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Готовы заполнить декларацию?</h2>
          <p className="cta__text">
            Анкета с подсказками к каждому полю занимает 15 минут, документы
            открываются сразу после оплаты.
          </p>
          <div className="cta__actions">
            <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
              Заполнить самому
            </Link>
            <Link to="/deklaraciya" className="btn btn--light btn--lg">
              ← Вернуться на страницу услуги
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
