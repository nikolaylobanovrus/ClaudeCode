import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";

export default function NotFound() {
  return (
    <>
      <Seo
        title="Страница не найдена — 404 | Налог-сервис"
        description="Запрашиваемая страница не найдена."
        path="/404"
        noindex
      />
      <section className="notfound container">
        <div className="notfound__code">404</div>
        <h1 className="notfound__title">Страница не найдена</h1>
        <p className="notfound__text">
          Возможно, страница была перемещена или её адрес указан неверно.
        </p>
        <Link to="/" className="btn btn--primary btn--lg">
          Вернуться на главную
        </Link>
      </section>
    </>
  );
}
