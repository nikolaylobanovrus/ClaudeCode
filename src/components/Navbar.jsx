import { useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { company } from "../data/content.js";
import { isLoggedIn } from "../lib/account.js";
import Logo from "./Logo.jsx";

// Шапка основного сайта. «Главной» в меню нет — на неё ведёт клик по логотипу.
// «Заполнить самому» (99 ₽) намеренно НЕ в этом меню: сервис рекламируется
// отдельным лендингом /deklaraciya, чтобы дешёвый тариф не перетягивал
// клиентов основных тарифов (решение владельца, июль 2026).
const MAIN_LINKS = [
  { to: "/vychety", label: "Виды вычетов" },
  { to: "/kak-rabotaem", label: "Как работаем" },
  { to: "/tarify", label: "Тарифы" },
  { to: "/kontakty", label: "Контакты" },
];

// Раздел «Заполнить самому» — самостоятельный мини-сайт: у него свои пункты
// меню и логотип ведёт на его лендинг, чтобы рекламный трафик не «утекал»
// в основной сайт. «Виды вычетов» и «Как работаем» — секции лендинга (scrollTo),
// «Тарифы» — своя страница; «Кабинета» у авто-вычета нет.
const SELF_LINKS = [
  { to: "/deklaraciya", scrollTo: "sd-vychety", label: "Виды вычетов" },
  { to: "/deklaraciya", scrollTo: "sd-kak-rabotaem", label: "Как работаем" },
  { to: "/deklaraciya/tarify", label: "Тарифы" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Внутри раздела авто-вычета — своя шапка.
  const isSelf = pathname.startsWith("/deklaraciya");
  const brandTo = isSelf ? "/deklaraciya" : "/";
  const links = isSelf ? SELF_LINKS : MAIN_LINKS;
  const cabinetTarget = isLoggedIn() ? "/kabinet" : "/vhod";

  // Клик по пункту-секции: если уже на лендинге — прокрутка; иначе переход
  // на лендинг с id секции в state (там сработает scrollTo).
  const onLinkClick = (e, link) => {
    close();
    if (!link.scrollTo) return;
    e.preventDefault();
    e.currentTarget.blur(); // это прокрутка, а не «текущая страница» — не оставляем в фокусе
    if (pathname === "/deklaraciya") {
      document.getElementById(link.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/deklaraciya", { state: { scrollTo: link.scrollTo } });
    }
  };

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to={brandTo} className="navbar__brand" onClick={close}>
          <Logo />
          <span>
            Налог<span className="navbar__brand-accent">-сервис</span>
          </span>
        </Link>

        {/* Телефон в верхней строке для узких экранов (когда меню — бургер) */}
        <a
          href={`tel:${company.phoneRaw}`}
          className="navbar__phone-top"
          aria-label={`Позвонить: ${company.phone}`}
        >
          <span className="navbar__phone-top-ico" aria-hidden="true">
            📞
          </span>
          <span className="navbar__phone-top-num">{company.phone}</span>
        </a>

        <button
          className="navbar__toggle"
          aria-label="Меню"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={"navbar__nav" + (open ? " is-open" : "")}>
          {links.map((l) => (
            <NavLink
              key={l.label}
              to={l.to}
              end
              className={({ isActive }) =>
                "navbar__link" + (isActive && !l.scrollTo ? " is-active" : "")
              }
              onClick={(e) => onLinkClick(e, l)}
            >
              {l.label}
            </NavLink>
          ))}
          {/* «Кабинет» — только на основном сайте (у авто-вычета его нет) */}
          {!isSelf && (
            <NavLink
              to={cabinetTarget}
              className={({ isActive }) =>
                "navbar__link" + (isActive ? " is-active" : "")
              }
              onClick={close}
            >
              Кабинет
            </NavLink>
          )}
          <span className="navbar__phone">
            <a href={`tel:${company.phoneRaw}`}>{company.phone}</a>
            <span>Колл-центр 24/7</span>
          </span>
          {isSelf ? (
            <Link
              to="/deklaraciya/anketa"
              className="btn btn--primary navbar__cta"
              onClick={close}
            >
              Заполнить декларацию
            </Link>
          ) : (
            <Link to="/kontakty" className="btn btn--primary navbar__cta" onClick={close}>
              Оставить заявку
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
