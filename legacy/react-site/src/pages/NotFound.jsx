import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="notfound">
      <div className="container">
        <div className="notfound__code">404</div>
        <h1 className="notfound__title">Страница не найдена</h1>
        <p className="notfound__text">
          Похоже, такой страницы не существует или она была перемещена.
        </p>
        <Link to="/" className="btn btn--primary btn--lg">
          На главную
        </Link>
      </div>
    </section>
  );
}
