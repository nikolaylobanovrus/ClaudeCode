import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA приложения обслуживается FastAPI под префиксом /app.
// Сборка кладётся в web/static/app, откуда её раздаёт наш бэкенд.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: '../web/static/app',
    emptyOutDir: true,
  },
})
