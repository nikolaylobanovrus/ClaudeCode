// Общий стенд для браузерных проверок и пререндера: статический сервер над
// dist/ и запуск Chromium.
//
// Раньше это было скопировано в check-wizard.mjs и check-no-hscroll.mjs, и
// копии уже начали расходиться: в одной тип файла определялся по отдаваемому
// файлу (иначе браузер предлагал СКАЧАТЬ главную — расширения у «/» нет), в
// другой нет; наборы MIME разные. С появлением пререндера потребителей стало
// четыре — дальше расхождения гарантированы.
//
// Отдельно: режим фолбэка. До перехода на чистые URL сервер отдавал главную
// на любой неизвестный путь, как nginx. После перехода каждая страница лежит
// в dist настоящим файлом, и проверять надо СТРОГО — иначе опечатка в пути
// молча покажет главную, и проверка вёрстки девять раз проверит один экран.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// root — каталог сборки (по умолчанию dist/ рядом со скриптами).
// fallback: "index" — SPA-режим, как nginx до этапа C;
//           "404"   — строгий, как nginx после: несуществующее отдаёт 404.
export async function serveDist({ root, fallback = "index" } = {}) {
  const ROOT = root || new URL("../dist/", import.meta.url).pathname;

  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    // Каталог → index.html внутри него: ровно то, что делает nginx
    // директивой try_files $uri $uri/index.html.
    const candidates =
      urlPath === "/"
        ? ["index.html"]
        : [urlPath.replace(/^\//, ""), join(urlPath.replace(/^\//, ""), "index.html")];

    for (const rel of candidates) {
      try {
        const file = join(ROOT, normalize("/" + rel));
        const body = await readFile(file);
        res.writeHead(200, {
          "Content-Type": MIME[extname(file)] || "application/octet-stream",
        });
        return res.end(body);
      } catch {
        /* пробуем следующий вариант */
      }
    }

    if (fallback === "index") {
      try {
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        return res.end(await readFile(join(ROOT, "index.html")));
      } catch {
        return res.writeHead(404).end("нет dist/ — соберите: npm run build");
      }
    }
    // Строгий режим: как боевой nginx после этапа C. Файл читаем ДО отправки
    // заголовков — иначе на отсутствующем 404.html получаем вторую попытку
    // writeHead и падение сервера вместо честного ответа.
    let body = null;
    try {
      body = await readFile(join(ROOT, "404.html"));
    } catch {
      /* тела нет — ответим коротким текстом */
    }
    res.writeHead(404, { "Content-Type": MIME[body ? ".html" : ".txt"] });
    return res.end(body || "не найдено (нет dist/404.html — запустите npm run prerender)");
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, close: () => new Promise((r) => server.close(r)) };
}

// Chromium в этой среде предустановлен; путь переопределяется переменной,
// чтобы проверки запускались и на машине разработчика.
export const launchChromium = (opts = {}) =>
  chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    ...opts,
  });

// Внешние счётчики и база в проверках не нужны: они делают результат
// зависящим от интернета, а в пререндере ещё и попадают в сохранённый HTML.
export const blockExternals = (ctx) =>
  ctx.route(/mc\.yandex\.ru|top-fwz1\.mail\.ru|supabase\.co|yookassa\.ru/, (r) => r.abort());
