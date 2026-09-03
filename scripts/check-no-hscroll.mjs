// Регрессия: страница не должна ездить по горизонтали на телефоне.
//
// Зачем отдельная проверка. Этот дефект укусил нас четыре раза подряд и
// каждый раз выглядел одинаково для владельца: «кнопки съехали», «содержимое
// обрезано слева». Причина всегда одна — флекс- или грид-элемент, который не
// сжимается ýже своего содержимого (min-width по умолчанию равен ширине
// контента), растягивает документ шире экрана. Глазами это не ловится:
// страница выглядит нормально, пока её не сдвинуть пальцем вбок.
//
// Запуск: node scripts/check-no-hscroll.mjs
// Требует собранный dist/ (npm run build) — проверяем ровно то, что уедет
// на сервер. Ненулевой код возврата = есть горизонтальный вылет.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const PORT = 4399;

// Ширины реальных телефонов и увеличенный системный шрифт: именно на нём
// вылезала липкая панель, а при обычном всё было в порядке.
const WIDTHS = [320, 360, 390, 412];
const FONT_SCALES = [1, 1.5];
const PAGES = [
  "#/",
  "#/deklaraciya/anketa",
  "#/deklaraciya/instrukciya",
  "#/deklaraciya/kalkulyator-naloga-s-prodazhi",
  "#/deklaraciya/tarify",
  "#/vychety",
  "#/tarify",
  "#/kak-rabotaem",
  "#/pod-klyuch",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  const file = join(ROOT, normalize(path === "/" ? "/index.html" : path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    // SPA-фолбэк, как в nginx на сервере
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(await readFile(join(ROOT, "index.html")));
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
});

const problems = [];
for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 740 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  // Счётчики наружу не пускаем: без сети тест быстрее и не мигает.
  await ctx.route(/mc\.yandex\.ru|top-fwz1\.mail\.ru|supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(`http://127.0.0.1:${PORT}/${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const accept = page.getByRole("button", { name: /Принять/ });
    if (await accept.count()) await accept.first().click().catch(() => {});
    for (const scale of FONT_SCALES) {
      await page.evaluate((s) => {
        document.documentElement.style.fontSize = `${16 * s}px`;
      }, scale);
      await page.waitForTimeout(250);
      const found = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth - vw;
        if (over <= 1) return null;
        const worst = [...document.querySelectorAll("body *")]
          .map((el) => ({ el, out: Math.round(el.getBoundingClientRect().right - vw) }))
          .filter((x) => x.out > 1)
          .sort((a, b) => b.out - a.out)[0];
        return {
          over,
          culprit: worst
            ? `${worst.el.tagName}.${String(worst.el.className).slice(0, 50)} (+${worst.out}px)`
            : "не определён",
        };
      });
      if (found)
        problems.push(
          `${width}px, шрифт ×${scale}, ${path} — документ шире экрана на ${found.over}px; виновник: ${found.culprit}`
        );
    }
  }
  await ctx.close();
}
await browser.close();
server.close();

if (problems.length) {
  console.error("Горизонтальный скролл на телефоне:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(
  `Горизонтального скролла нет: ${PAGES.length} страниц × ${WIDTHS.length} ширин × ${FONT_SCALES.length} размера шрифта.`
);
