import { Link, useLocation, useNavigate } from "react-router-dom";
import { company } from "../data/content.js";
import Logo from "./Logo.jsx";

// Разделы подвала — свои для основного сайта и для авто-вычета (как в шапке):
// внутри /deklaraciya/* ссылки ведут по разделу, а не в основной сайт.
const MAIN_SECTIONS = [
  { to: "/vychety", label: "Виды вычетов" },
  { to: "/kak-rabotaem", label: "Как работаем" },
  { to: "/tarify", label: "Тарифы" },
  { to: "/kontakty", label: "Контакты" },
];
const SELF_SECTIONS = [
  { to: "/", scrollTo: "sd-vychety", label: "Виды вычетов" },
  { to: "/", scrollTo: "sd-kak-rabotaem", label: "Как работаем" },
  { to: "/deklaraciya/tarify", label: "Тарифы" },
  { to: "/deklaraciya/kontakty", label: "Контакты" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Самозаполнение: главная и /deklaraciya/* (лендинг теперь живёт на «/»).
  const isSelf = pathname === "/" || pathname.startsWith("/deklaraciya");
  const sections = isSelf ? SELF_SECTIONS : MAIN_SECTIONS;

  // Ссылка-секция лендинга: прокрутка (если уже на лендинге) или переход
  // на лендинг с id секции — там сработает scrollTo (см. SelfService.jsx).
  const onSectionClick = (e, link) => {
    if (!link.scrollTo) return;
    e.preventDefault();
    if (pathname === "/") {
      document.getElementById(link.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: link.scrollTo } });
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link to={isSelf ? "/" : "/pod-klyuch"} className="footer__brand">
              <Logo />
              Налог-сервис
            </Link>
            <p className="footer__tagline">
              Онлайн-сервис профессиональной помощи по заполнению декларации
              3-НДФЛ и оформлению налогового вычета.
            </p>
          </div>

          <nav className="footer__col">
            <h4 className="footer__title">Разделы</h4>
            {sections.map((l) => (
              <Link key={l.label} to={l.to} onClick={(e) => onSectionClick(e, l)}>
                {l.label}
              </Link>
            ))}
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
