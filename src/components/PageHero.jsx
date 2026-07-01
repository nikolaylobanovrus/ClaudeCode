import { Link } from "react-router-dom";

// Шапка внутренних страниц с хлебными крошками (важно для SEO и навигации).
export default function PageHero({ eyebrow, title, subtitle, crumbs = [] }) {
  return (
    <section className="page-hero">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/">Главная</Link>
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
