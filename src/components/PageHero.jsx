import { Link, useLocation } from "react-router-dom";

// Шапка внутренних страниц с хлебными крошками (важно для SEO и навигации).
export default function PageHero({ eyebrow, title, subtitle, crumbs = [] }) {
  const { pathname } = useLocation();
  // «Главная» контекстная: в разделе самозаполнения (главная и /deklaraciya/*)
  // ведёт на «/», в разделе «под ключ» — на его лендинг /pod-klyuch.
  const homeTo =
    pathname === "/" || pathname.startsWith("/deklaraciya") ? "/" : "/pod-klyuch";
  return (
    <section className="page-hero">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link to={homeTo}>Главная</Link>
          {crumbs.map((c) => (
            <span key={c}>/ {c}</span>
          ))}
        </nav>
        {eyebrow && <span className="eyebrow hero__eyebrow">{eyebrow}</span>}
        <h1 className="page-hero__title">{title}</h1>
        {subtitle && <p className="page-hero__subtitle">{subtitle}</p>}
      </div>
    </section>
  );
}
