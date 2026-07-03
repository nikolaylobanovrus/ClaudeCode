import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react()],
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
