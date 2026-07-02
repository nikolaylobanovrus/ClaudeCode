import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { company } from "../data/content.js";
import { getAccount } from "../lib/account.js";

const LINKS = [
  { to: "/", label: "Главная", end: true },
  { to: "/vychety", label: "Виды вычетов" },
  { to: "/kak-rabotaem", label: "Как работаем" },
  { to: "/tarify", label: "Тарифы" },
  { to: "/kontakty", label: "Контакты" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const account = getAccount();

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand" onClick={close}>
          <span className="navbar__logo" aria-hidden="true">
            ₽
          </span>
          Налог<span className="navbar__brand-accent">-сервис</span>
        </Link>

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
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                "navbar__link" + (isActive ? " is-active" : "")
              }
              onClick={close}
            >
              {l.label}
            </NavLink>
          ))}
          {account && (
            <NavLink
              to="/kabinet"
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
          <Link to="/kontakty" className="btn btn--primary navbar__cta" onClick={close}>
            Оставить заявку
          </Link>
        </nav>
      </div>
    </header>
  );
}
