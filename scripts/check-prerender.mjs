#!/usr/bin/env node
// Проверка пререндера: то ли мы положили в dist, что собирались.
//
//   npm run check:prerender     (после npm run prerender)
//
// Зачем именно проверка, а не доверие скрипту. Пререндер молча деградирует:
// снимок, снятый на полсекунды раньше, чем надо, выглядит как нормальный
// HTML — с шапкой, подвалом и пустой серединой. Поисковик получит такую
// страницу и решит, что на сайте пусто. Заметить это глазами нельзя: файл
// есть, размер правдоподобный.
//
// Поэтому проверяем по файлам, а не по логу предыдущего шага.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROUTES, routeFile } from "../src/data/routes.js";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://налог-сервис.рф";
const problems = [];
const titles = new Map();

const one = (html, re) => (html.match(re) || []).length;

for (const route of ROUTES) {
  const file = routeFile(route.path);
  let html;
  try {
    html = await readFile(join(DIST, file), "utf8");
  } catch {
    problems.push(`${route.path} — нет файла dist/${file}`);
    continue;
  }

  // Страницы за логином кладутся оболочкой сознательно: содержимого там нет
  // и быть не должно. Проверяем только, что файл на месте (см. выше).
  if (route.gated) continue;

  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || "";
  if (!title) problems.push(`${route.path} — пустой <title>`);
  if (titles.has(title))
    problems.push(
      `${route.path} — тот же <title>, что у ${titles.get(title)}: снимок снят до того, как проставились мета-теги`
    );
  titles.set(title, route.path);

  if (!/<h1/.test(html)) problems.push(`${route.path} — нет <h1>: краулер увидит страницу без заголовка`);

  // Берём всё от контейнера приложения до конца body. Не «до первого
  // </div>»: вложенных закрывающих тегов в разметке десятки, и такая
  // регулярка отрезала бы почти весь текст (на этом я и попался).
  const start = html.indexOf('<div id="root">');
  const body = start < 0 ? "" : html.slice(start, html.indexOf("</body>"));
  const text = body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 400)
    problems.push(
      `${route.path} — в #root всего ${text.length} знаков текста: пререндер снялся слишком рано`
    );

  const canon = one(html, /<link[^>]+rel="canonical"/g);
  if (canon !== 1) problems.push(`${route.path} — canonical встречается ${canon} раз, нужен ровно один`);
  const href = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1];
  if (href && href !== SITE + route.path)
    problems.push(`${route.path} — canonical указывает на ${href}`);

  const desc = one(html, /<meta[^>]+name="description"/g);
  if (desc !== 1) problems.push(`${route.path} — description встречается ${desc} раз, нужен ровно один`);

  // Главное, ради чего затевался санитайзер: на закрытой странице не должно
  // остаться статического «index, follow» рядом с helmet-овским «noindex».
  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html);
  const indexFollow = /<meta[^>]+name="robots"[^>]+content="index/.test(html);
  if (route.index && noindex) problems.push(`${route.path} — индексируемая, но помечена noindex`);
  if (!route.index && !noindex) problems.push(`${route.path} — закрытая, но без noindex`);
  if (!route.index && indexFollow)
    problems.push(`${route.path} — рядом с noindex остался «index, follow»`);

  if (html.includes("127.0.0.1"))
    problems.push(`${route.path} — в HTML попал адрес стенда 127.0.0.1`);
  const metrika = one(html, /mc\.yandex\.ru\/metrika/g);
  if (metrika > 1) problems.push(`${route.path} — счётчик Метрики продублирован (${metrika} раз)`);
}

// 404 — тело для error_page в nginx.
try {
  const html = await readFile(join(DIST, "404.html"), "utf8");
  if (!/notfound/.test(html)) problems.push("404.html — не похоже на страницу «не найдено»");
} catch {
  problems.push("404.html — нет файла");
}

// Карта сайта: ровно индексируемые страницы, ни больше ни меньше.
try {
  const xml = await readFile(join(DIST, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const want = ROUTES.filter((r) => r.index).map((r) => SITE + r.path);
  for (const w of want) if (!locs.includes(w)) problems.push(`sitemap — нет ${w}`);
  for (const l of locs) if (!want.includes(l)) problems.push(`sitemap — лишний ${l}`);
  if (!/^<\?xml/.test(xml)) problems.push("sitemap — нет XML-заголовка");
} catch {
  problems.push("sitemap.xml — нет файла");
}

for (const p of problems) console.log("✗ " + p);
console.log(
  problems.length
    ? `\nПРОБЛЕМ: ${problems.length}`
    : `Пререндер в порядке: ${ROUTES.length} страниц, у каждой свой заголовок и canonical, карта сайта сходится.`
);
process.exit(problems.length ? 1 : 0);
