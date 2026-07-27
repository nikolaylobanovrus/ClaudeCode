import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";
import { initVkPixel } from "./lib/vkpixel.js";

// На GitHub Pages сайт живёт в подкаталоге без серверного SPA-fallback,
// поэтому там используем HashRouter (сборка задаёт VITE_HASH_ROUTER=1).
// В обычной сборке (локально и на «боевом» домене) — BrowserRouter с чистыми URL.
const useHash = import.meta.env.VITE_HASH_ROUTER === "1";
const Router = useHash ? HashRouter : BrowserRouter;
const routerProps = useHash ? {} : { basename: import.meta.env.BASE_URL };

// Рекламные площадки дописывают свои параметры в конец ссылки ПОСЛЕ решётки
// через «&» (напр. Telega.in: «#/deklaraciya&erid=…»). Для HashRouter это
// часть пути — маршрут не находится и человек с рекламы попадает на 404.
// Нормализуем до рендера: «#/путь&хвост» → «#/путь?хвост» (параметры уходят
// в search внутри хэша, роутер их игнорирует). replaceState — без перезагрузки.
if (useHash) {
  const m = window.location.hash.match(/^(#\/[^?&]*)&(.+)$/);
  if (m) {
    const fixed =
      window.location.pathname + window.location.search + m[1] + "?" + m[2];
    window.history.replaceState(null, "", fixed);
  }
}

// Пиксель VK Рекламы (no-op, пока в vkpixel.js не вписан ID).
initVkPixel();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router {...routerProps}>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
