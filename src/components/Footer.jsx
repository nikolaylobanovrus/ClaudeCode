import { Link } from "react-router-dom";
import { company } from "../data/content.js";
import Logo from "./Logo.jsx";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand">
              <Logo />
              Налог-сервис
            </div>
            <p className="footer__tagline">
              Онлайн-сервис профессиональной помощи по заполнению декларации
              3-НДФЛ и оформлению налогового вычета.
            </p>
          </div>

          <nav className="footer__col">
            <h4 className="footer__title">Разделы</h4>
            <Link to="/vychety">Виды вычетов</Link>
            <Link to="/kak-rabotaem">Как работаем</Link>
            <Link to="/tarify">Тарифы</Link>
            <Link to="/kontakty">Контакты</Link>
          </nav>

          <nav className="footer__col">
            <h4 className="footer__title">Документы</h4>
            <Link to="/politika-konfidencialnosti">
              Политика конфиденциальности
            </Link>
            <Link to="/publichnaya-oferta">Публичная оферта</Link>
          </nav>

          <div className="footer__col">
            <h4 className="footer__title">Контакты</h4>
            <a href={`tel:${company.phoneRaw}`}>{company.phone}</a>
            <a href={`mailto:${company.email}`}>{company.email.toLowerCase()}</a>
            <div className="messengers" style={{ marginTop: 8 }}>
              <a className="messenger messenger--tg" href={company.telegram} target="_blank" rel="noreferrer">
                Telegram
              </a>
              <a className="messenger messenger--max" href={company.max} target="_blank" rel="noreferrer">
                Max
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__disclaimer">
        <div className="container">
          {company.legalName} · ИНН {company.inn} · ОГРН {company.ogrn} ·{" "}
          {company.address}. Услуги оказываются на основании{" "}
          <Link to="/publichnaya-oferta" style={{ textDecoration: "underline" }}>
            Публичной оферты
          </Link>
          . Сайт носит информационный характер и не является публичной офертой в
          части индивидуальных условий.
        </div>
      </div>

      <div className="footer__bottom container">
        <span>© {year} Налог-сервис. Все права защищены.</span>
        <span>
          Возврат налоговых вычетов НДФЛ по всей России
          <span style={{ opacity: 0.45, marginLeft: 10, fontSize: 11 }}>
            сборка {__BUILD_TS__}
          </span>
        </span>
      </div>
    </footer>
  );
}
