import { useEffect, useRef } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import CookieBanner from "./CookieBanner.jsx";
import ChatWidget from "./ChatWidget.jsx";
import { company } from "../data/content.js";
import { ymHit } from "../lib/metrika.js";

export default function Layout() {
  const { pathname } = useLocation();

  // Первый просмотр уже отправлен init-ом счётчика в index.html —
  // хитом сопровождаем только последующие смены роута, иначе задвоение.
  const firstHit = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstHit.current) {
      firstHit.current = false;
      return;
    }
    ymHit(window.location.href);
  }, [pathname]);

  return (
    <div className="site">
      <Navbar />
      <main className="site__main">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
      {/* Чат помощи — на всех страницах, кроме служебной операторской */}
      {pathname !== "/operator" && <ChatWidget />}

      {/* Липкая мобильная панель конверсии (на странице документов — своя).
          В разделе авто-вычета ведёт к заполнению, а не в основной сайт.
          На самой анкете панель скрыта: «Заполнить» вёл на текущую же
          страницу, «Позвонить» уводил из воронки, а на шаге оплаты панель
          соседствовала с настоящей кнопкой «Оплатить». */}
      {!pathname.startsWith("/situaciya") && pathname !== "/deklaraciya/anketa" && (
        <div className="mobile-cta">
          <a href={`tel:${company.phoneRaw}`} className="btn btn--ghost">
            Позвонить
          </a>
          {pathname.startsWith("/deklaraciya") ? (
            <Link to="/deklaraciya/anketa" className="btn btn--primary">
              Заполнить
            </Link>
          ) : (
            <Link to="/kontakty" className="btn btn--primary">
              Заявка
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
