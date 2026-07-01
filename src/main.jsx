import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

// На GitHub Pages сайт живёт в подкаталоге без серверного SPA-fallback,
// поэтому там используем HashRouter (сборка задаёт VITE_HASH_ROUTER=1).
// В обычной сборке (локально и на «боевом» домене) — BrowserRouter с чистыми URL.
const useHash = import.meta.env.VITE_HASH_ROUTER === "1";
const Router = useHash ? HashRouter : BrowserRouter;
const routerProps = useHash ? {} : { basename: import.meta.env.BASE_URL };

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <Router {...routerProps}>
        <App />
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);
