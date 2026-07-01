import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";

export default function Layout() {
  const { pathname } = useLocation();

  // Прокручиваем страницу наверх при смене маршрута.
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
    </div>
  );
}
