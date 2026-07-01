import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Базовый путь: "/" локально и на боевом домене, "./" для GitHub Pages
  // (задаётся переменной окружения VITE_BASE в CI).
  base: process.env.VITE_BASE || "/",
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
