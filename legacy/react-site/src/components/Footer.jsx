import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="navbar__logo" aria-hidden="true">
            ✦
          </span>
          <span>
            Nebula<strong>Studio</strong>
          </span>
          <p className="footer__tagline">
            Проектируем и запускаем цифровые продукты.
          </p>
        </div>

        <nav className="footer__col">
          <h4 className="footer__title">Навигация</h4>
          <Link to="/services">Услуги</Link>
          <Link to="/work">Работы</Link>
          <Link to="/about">О студии</Link>
          <Link to="/contact">Контакты</Link>
        </nav>

        <div className="footer__col">
          <h4 className="footer__title">Контакты</h4>
          <a href="mailto:hello@nebula.studio">hello@nebula.studio</a>
          <a href="tel:+70000000000">+7 (000) 000-00-00</a>
          <span>Москва · удалённо по миру</span>
        </div>
      </div>

      <div className="footer__bottom container">
        <span>© {year} Nebula Studio. Все права защищены.</span>
        <span>Сделано на React + Vite</span>
      </div>
    </footer>
  );
}
