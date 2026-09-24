import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";
import { initVkPixel } from "./lib/vkpixel.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Резервная площадка GitHub Pages живёт в подкаталоге без серверного
// SPA-фолбэка, поэтому там HashRouter (сборка задаёт VITE_HASH_ROUTER=1).
// Боевой сайт и локальная разработка — BrowserRouter с чистыми URL: на VPS
// фолбэк делает nginx (deploy/nginx-nalog-servis.conf), а с 24.09.2026 туда
// уезжают ещё и заранее отрисованные страницы (scripts/prerender.mjs).
const useHash = import.meta.env.VITE_HASH_ROUTER === "1";
const Router = useHash ? HashRouter : BrowserRouter;
const routerProps = useHash ? {} : { basename: import.meta.env.BASE_URL };

// Обратное преобразование для хеш-сборки: чистый адрес → адрес с решёткой.
//
// Нужно ровно на два случая, и оба аварийные: откат боевой сборки обратно на
// хеш, когда по свету уже разошлись чистые ссылки-черновики, и переключение
// DNS на резервную площадку GitHub Pages, где SPA-фолбэка нет и любой чистый
// адрес даёт жёсткий 404 самой площадки. Пять строк, снимающих самый
// неприятный сценарий отката.
//
// Прямое преобразование (старый «#/путь» → «/путь») делает отдельный шим,
// встроенный первым тегом в <head>: см. scripts/hash-url-shim.js. Здесь его
// быть не может — он обязан отработать раньше инициализации Метрики.
if (useHash) {
  const base = import.meta.env.BASE_URL || "/";
  const { pathname, search, hash } = window.location;
  if (!hash && pathname !== base && pathname.startsWith(base)) {
    const path = "/" + pathname.slice(base.length).replace(/^\//, "");
    window.history.replaceState(null, "", base + "#" + path + search);
  }

  // Рекламные площадки дописывают свои параметры в конец ссылки ПОСЛЕ решётки
  // через «&» (напр. Telega.in: «#/deklaraciya&erid=…»). Для HashRouter это
  // часть пути — маршрут не находится и человек с рекламы попадает на 404.
  // Нормализуем до рендера: «#/путь&хвост» → «#/путь?хвост».
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
        {/* Внешний ограничитель: всё, что вне анкеты (лендинги, калькулятор,
            кабинет). Внутри анкеты есть свой, вокруг шага. */}
        <ErrorBoundary where="app">
          <App />
        </ErrorBoundary>
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
