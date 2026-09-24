#!/usr/bin/env node
// Пререндер: превращает одностраничное приложение в набор готовых HTML.
//
//   npm run prerender        (после npm run build)
//
// Зачем. Краулер получает от нас пустой <div id="root"> — весь текст сайта
// появляется только после исполнения JS. Яндекс и Google это умеют, но
// индексируют такие страницы медленнее и хуже, а ИИ-поисковики и превью в
// мессенджерах не умеют вовсе. За 85 дней из поиска пришло 36 визитов.
//
// Что делает: поднимает собранный dist, открывает каждую страницу в Chromium,
// дожидается, пока отрисуется содержимое и проставятся мета-теги, и
// сохраняет получившийся HTML в dist/<путь>/index.html. Заодно пишет
// sitemap.xml из того же списка, чтобы карта и страницы не разъезжались.
//
// Гидратации здесь нет: main.jsx поднимает приложение через createRoot, то
// есть React при старте очистит контейнер и отрисует заново. Это осознанно —
// hydrateRoot с ленивыми маршрутами, чтением localStorage в анкете и
// баннером cookies даёт расхождения и мигание хуже нынешнего. Задача
// пререндера здесь — краулер и первая отрисовка, а не серверный рендеринг.
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ROUTES, routeFile } from "../src/data/routes.js";
import { serveDist, launchChromium, blockExternals } from "./_serve-dist.mjs";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://налог-сервис.рф"; // == company.site (src/data/content.js)
const TIMEOUT = 20000;

const { base, close } = await serveDist({ root: DIST, fallback: "index" });
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await blockExternals(ctx);

// HTML копится в памяти и пишется ТОЛЬКО после остановки сервера: страница «/»
// сохраняется в dist/index.html — тот самый файл, который сервер сейчас
// раздаёт как фолбэк. Записать его на ходу значит подменить стенд под собой.
const rendered = [];
const problems = [];

const page = await ctx.newPage();
const errors = [];
// Запросы к счётчикам мы обрываем сами (blockExternals) — браузер пишет об
// этом в консоль как об ошибке загрузки ресурса. Считать её поломкой
// страницы нельзя: тогда ни одна страница не пререндерится.
const ourOwnBlock = (t) =>
  /Failed to load resource/i.test(t) ||
  /net::ERR_FAILED/i.test(t) ||
  /ERR_BLOCKED_BY_CLIENT/i.test(t);
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
page.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !ourOwnBlock(t)) errors.push(t.slice(0, 200));
});

// Оболочка приложения как есть — для страниц за логином (см. gated в
// routes.js). Читаем ДО обхода: дальше dist/index.html будет перезаписан.
const shell = await readFile(join(DIST, "index.html"), "utf8");

for (const route of ROUTES) {
  if (route.gated) {
    rendered.push([routeFile(route.path), shell]);
    console.log(`   · ${route.path.padEnd(44)} за логином, кладём оболочку`);
    continue;
  }
  errors.length = 0;
  const url = base + route.path;
  try {
    await page.goto(url, { waitUntil: "load", timeout: TIMEOUT });
    // Три условия сразу: мета-теги проставлены (react-helmet-async метит свои
    // теги data-rh), содержимое отрисовано, маршрут не увёл редиректом.
    await page.waitForFunction(
      (expected) => {
        const canonical = document.querySelector('link[rel="canonical"][data-rh="true"]');
        const main = document.querySelector(".site__main");
        return (
          canonical &&
          main &&
          main.innerText.trim().length > 40 &&
          location.pathname === expected
        );
      },
      route.path,
      { timeout: TIMEOUT }
    );
  } catch (e) {
    problems.push(`${route.path} — не отрисовалась: ${String(e.message).slice(0, 120)}`);
    continue;
  }
  if (errors.length) {
    problems.push(`${route.path} — ошибка в консоли: ${errors[0]}`);
    continue;
  }

  const html = await page.evaluate(() => {
    // 1. Счётчики, дописанные в runtime: в сохранённом файле им не место,
    //    статический тег Метрики в index.html и так остаётся.
    document
      .querySelectorAll('script[src*="mc.yandex.ru"], script[src*="top-fwz1.mail.ru"]')
      .forEach((n) => n.remove());
    // 2. Дубли SEO-тегов. В index.html лежит статический набор для главной
    //    (description, canonical, robots, og:*, twitter:*), а Seo.jsx рядом
    //    добавляет свои. Оставить оба — значит отдать поисковику две разные
    //    canonical, а на закрытых страницах ещё и «index, follow» рядом с
    //    «noindex». Статический вариант убираем ТОЛЬКО там, где есть
    //    helmet-двойник: без пререндера он по-прежнему нужен как запасной.
    const pairs = [
      ['meta[name="description"]', 'meta[name="description"][data-rh="true"]'],
      ['link[rel="canonical"]', 'link[rel="canonical"][data-rh="true"]'],
      ['meta[name="robots"]', 'meta[name="robots"][data-rh="true"]'],
      ['meta[name="keywords"]', null],
    ];
    for (const [all, rh] of pairs) {
      if (rh && !document.querySelector(rh)) continue;
      document.querySelectorAll(all).forEach((n) => {
        if (!n.hasAttribute("data-rh")) n.remove();
      });
    }
    for (const prop of ["og:", "twitter:"]) {
      const sel = prop === "og:" ? 'meta[property^="og:"]' : 'meta[name^="twitter:"]';
      const hasRh = [...document.querySelectorAll(sel)].some((n) => n.hasAttribute("data-rh"));
      if (!hasRh) continue;
      document.querySelectorAll(sel).forEach((n) => {
        if (!n.hasAttribute("data-rh")) n.remove();
      });
    }
    return "<!doctype html>\n" + document.documentElement.outerHTML;
  });

  rendered.push([routeFile(route.path), html]);
  console.log(`   ✓ ${route.path.padEnd(44)} ${(html.length / 1024).toFixed(0)} КБ`);
}

// Отдельно — тело для error_page: то, что nginx отдаст на несуществующий путь.
try {
  await page.goto(base + "/takogo-puti-net-" + Date.now(), { waitUntil: "load", timeout: TIMEOUT });
  await page.waitForSelector(".notfound", { timeout: TIMEOUT });
  rendered.push(["404.html", "<!doctype html>\n" + (await page.content())]);
  console.log("   ✓ 404.html");
} catch (e) {
  problems.push(`404.html — не отрисовалась: ${String(e.message).slice(0, 120)}`);
}

await browser.close();
await close();

if (problems.length) {
  for (const p of problems) console.log("   ✗ " + p);
  console.log(`\nПРЕРЕНДЕР НЕ УДАЛСЯ: ${problems.length} страниц. Ничего не записано.`);
  process.exit(1);
}

for (const [file, html] of rendered) {
  const full = join(DIST, file);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, html);
}

// Карта сайта из того же списка: разъехаться они физически не могут.
const today = new Date().toISOString().slice(0, 10);
const urls = ROUTES.filter((r) => r.index)
  .map(
    (r) =>
      `  <url>\n    <loc>${SITE}${r.path}</loc>\n    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  )
  .join("\n");
await writeFile(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);

console.log(
  `\nСохранено страниц: ${rendered.length}, в sitemap.xml: ${ROUTES.filter((r) => r.index).length}.`
);
