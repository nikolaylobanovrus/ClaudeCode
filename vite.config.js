import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Шим старых адресов с решёткой. Встраиваем первым тегом в <head> и ТОЛЬКО в
// сборку с обычным роутером: в хеш-сборке (резервная площадка GitHub Pages)
// он бы ломал навигацию, уводя с рабочих адресов.
//
// Через плагин, а не через плейсхолдер в index.html: при незаданной
// переменной Vite оставляет литерал «%VITE_HASH_ROUTER%» прямо в разметке и
// сыплет предупреждением. Здесь решение принимается в одном месте, а сам шим
// живёт отдельным файлом — его можно прочитать и проверить.
const hashUrlShim = () => ({
  name: "hash-url-shim",
  transformIndexHtml() {
    if (process.env.VITE_HASH_ROUTER === "1") return [];
    const code = readFileSync(
      new URL("./scripts/hash-url-shim.js", import.meta.url),
      "utf8"
    );
    return [{ tag: "script", children: code, injectTo: "head-prepend" }];
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  // Базовый путь: "/" локально и на боевом домене, "./" для GitHub Pages
  // (задаётся переменной окружения VITE_BASE в CI).
  base: process.env.VITE_BASE || "/",
  // Метка сборки — показывается в подвале, помогает сверять версию на живом сайте.
  define: {
    __BUILD_TS__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"
    ),
  },
  plugins: [react(), hashUrlShim()],
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
