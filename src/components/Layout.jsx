import { useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import CookieBanner from "./CookieBanner.jsx";
import { company } from "../data/content.js";

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="site">
      <Navbar />
      <main className="site__main">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />

      {/* Липкая мобильная панель конверсии (на странице документов — своя) */}
      {!pathname.startsWith("/situaciya") && (
        <div className="mobile-cta">
          <a href={`tel:${company.phoneRaw}`} className="btn btn--ghost">
            Позвонить
          </a>
          <Link to="/kontakty" className="btn btn--primary">
            Заявка
          </Link>
        </div>
      )}
    </div>
  );
}
