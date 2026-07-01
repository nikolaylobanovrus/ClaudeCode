import { useState } from "react";
import { NavLink, Link } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Главная", end: true },
  { to: "/services", label: "Услуги" },
  { to: "/work", label: "Работы" },
  { to: "/about", label: "О студии" },
  { to: "/contact", label: "Контакты" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand" onClick={() => setOpen(false)}>
          <span className="navbar__logo" aria-hidden="true">
            ✦
          </span>
          Nebula<span className="navbar__brand-accent">Studio</span>
        </Link>

        <button
          className="navbar__toggle"
          aria-label="Открыть меню"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={"navbar__nav" + (open ? " is-open" : "")}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                "navbar__link" + (isActive ? " is-active" : "")
              }
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/contact"
            className="btn btn--primary navbar__cta"
            onClick={() => setOpen(false)}
          >
            Обсудить проект
          </Link>
        </nav>
      </div>
    </header>
  );
}
