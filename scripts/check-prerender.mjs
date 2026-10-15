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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROUTES, REDIRECTS, routeFile } from "../src/data/routes.js";

const DIST = new URL("../dist/", import.meta.url).pathname;
const SITE = "https://налог-сервис.рф";
const problems = [];
const titles = new Map();

const one = (html, re) => (html.match(re) || []).length;

// --- Картинка превью ссылок -------------------------------------------------
// Повод, 15.10.2026: og:image полгода указывал на og-image.svg. Файл был и
// отдавался с кодом 200, поэтому «проверка по коду ответа» ничего бы не
// заметила — а превью в формате SVG не показывает ни один мессенджер и ни
// одна соцсеть. Ссылка пересылалась без картинки, и узнать об этом можно было
// только переслав её себе. Поэтому проверяем не наличие файла, а пригодность:
// растровый формат, файл на диске и размеры, совпадающие с мета-тегами.
const RASTER = /\.(png|jpe?g)$/i;
let ogSize = null; // настоящие размеры картинки, из самого файла
try {
  const png = await readFile(join(DIST, "og-image.png"));
  // IHDR лежит в первых 24 байтах PNG — внешних библиотек не нужно.
  if (png.subarray(1, 4).toString() === "PNG")
    ogSize = { w: png.readUInt32BE(16), h: png.readUInt32BE(20), bytes: png.length };
  else problems.push("og-image.png — это не PNG");
} catch {
  problems.push("og-image.png — нет файла в сборке (node scripts/build-og-image.mjs)");
}
if (ogSize && ogSize.bytes > 5 * 1024 * 1024)
  problems.push(`og-image.png — ${(ogSize.bytes / 1048576).toFixed(1)} МБ, площадки режут больше 5 МБ`);

function checkOg(html, label) {
  const n = one(html, /<meta[^>]+property="og:image"[^>]*>/g);
  if (n !== 1) {
    problems.push(`${label} — og:image ${n} шт., нужен ровно один`);
    return;
  }
  const src = (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || [])[1] || "";
  if (!RASTER.test(src)) {
    problems.push(`${label} — og:image ведёт на ${src}: превью показывают только растр (PNG/JPEG)`);
    return;
  }
  // Файл обязан лежать в сборке: ссылка на картинку, которой нет, выглядит
  // в точности как рабочая — до первой пересылки ссылки.
  const path = src.replace(SITE, "").replace(/^\//, "");
  if (!path) problems.push(`${label} — og:image пустой`);
  else if (!existsSync(join(DIST, path)))
    problems.push(`${label} — og:image ведёт на ${src}, а файла в сборке нет`);
  const w = (html.match(/<meta[^>]+property="og:image:width"[^>]+content="(\d+)"/) || [])[1];
  const h = (html.match(/<meta[^>]+property="og:image:height"[^>]+content="(\d+)"/) || [])[1];
  if (!w || !h) {
    problems.push(`${label} — у og:image нет размеров (og:image:width/height)`);
  } else if (ogSize && (Number(w) !== ogSize.w || Number(h) !== ogSize.h)) {
    problems.push(
      `${label} — в тегах ${w}×${h}, а в файле ${ogSize.w}×${ogSize.h}: площадка покажет обрезанную карточку`
    );
  }
  const tw = (html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/) || [])[1];
  if (tw && !RASTER.test(tw)) problems.push(`${label} — twitter:image ведёт на ${tw}, нужен растр`);
}

for (const route of ROUTES) {
  const file = routeFile(route.path);
  let html;
  try {
    html = await readFile(join(DIST, file), "utf8");
  } catch {
    problems.push(`${route.path} — нет файла dist/${file}`);
    continue;
  }

  // Картинка превью — у всех страниц, включая оболочки за логином: ссылку
  // пересылают на любую из них.
  checkOg(html, route.path);

  // Страницы за логином кладутся оболочкой сознательно: содержимого там нет
  // и быть не должно. Но голова у оболочки обязана быть своя: до 15.10.2026
  // они уезжали с головой ГЛАВНОЙ страницы — «robots: index, follow» и
  // «canonical» на главную, хотя в routes.js у всех index: false.
  if (route.gated) {
    if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html))
      problems.push(`${route.path} — оболочка за логином без noindex`);
    if (/<meta[^>]+name="robots"[^>]+content="index/.test(html))
      problems.push(`${route.path} — оболочка за логином помечена «index, follow»`);
    const gc = one(html, /<link[^>]+rel="canonical"/g);
    if (gc !== 0)
      problems.push(`${route.path} — в оболочке за логином canonical (${gc} шт.), он там не нужен`);
    continue;
  }

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

// Адреса-редиректы: файл обязан существовать и быть закрыт от индексации.
// Без файла nginx отдаёт 403 на каталог без index.html — так 28.09.2026 лёг
// адрес /deklaraciya на боевом сайте.
for (const [from, to] of REDIRECTS) {
  const file = routeFile(from);
  try {
    const html = await readFile(join(DIST, file), "utf8");
    if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html))
      problems.push(`${from} — редирект, но без noindex`);
    if (!html.includes(`href="${SITE}${to}"`))
      problems.push(`${from} — canonical не указывает на ${to}`);
  } catch {
    problems.push(`${from} — нет файла dist/${file}: nginx отдаст 403 на каталог без index.html`);
  }
}

// 404 — тело для error_page в nginx. Проверяется той же меркой, что страницы
// из ROUTES: раньше здесь стояла одна строчка про «похоже на страницу не
// найдено», и этого хватило, чтобы на боевом полгода жили два <meta robots>,
// два canonical (статический — на главную!), два description и две копии
// счётчика. Нашлось глазами, а не проверкой — значит проверка была не та.
try {
  const html = await readFile(join(DIST, "404.html"), "utf8");
  if (!/notfound/.test(html)) problems.push("404.html — не похоже на страницу «не найдено»");

  const r = one(html, /<meta[^>]+name="robots"/g);
  if (r !== 1) problems.push(`404.html — robots встречается ${r} раз, нужен ровно один`);
  if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html))
    problems.push("404.html — без noindex");
  if (/<meta[^>]+name="robots"[^>]+content="index/.test(html))
    problems.push("404.html — рядом с noindex остался «index, follow»");

  // canonical у 404 не должно быть ВООБЩЕ: её адреса не существует (тело
  // отдаёт nginx на любой несуществующий путь), а canonical рядом с noindex —
  // противоречивая пара. Прежде их было два, и статический указывал на
  // главную: каждый мусорный адрес объявлял себя главной страницей.
  const c = one(html, /<link[^>]+rel="canonical"/g);
  if (c !== 0) problems.push(`404.html — canonical ${c} шт., а у страницы 404 его быть не должно`);

  const d = one(html, /<meta[^>]+name="description"/g);
  if (d !== 1) problems.push(`404.html — description встречается ${d} раз, нужен ровно один`);

  const m = one(html, /mc\.yandex\.ru\/metrika/g);
  if (m > 1) problems.push(`404.html — счётчик Метрики продублирован (${m} раз)`);
  checkOg(html, "404.html");
  if (html.includes("127.0.0.1")) problems.push("404.html — в HTML попал адрес стенда 127.0.0.1");
} catch {
  problems.push("404.html — нет файла");
}

// Оболочки редиректов — тем же набором: один robots, один canonical.
for (const [from] of REDIRECTS) {
  try {
    const html = await readFile(join(DIST, routeFile(from)), "utf8");
    const r = one(html, /<meta[^>]+name="robots"/g);
    if (r !== 1) problems.push(`${from} — robots встречается ${r} раз, нужен ровно один`);
    const c = one(html, /<link[^>]+rel="canonical"/g);
    if (c !== 1) problems.push(`${from} — canonical встречается ${c} раз, нужен ровно один`);
    checkOg(html, from);
  } catch {
    /* отсутствие файла уже сообщено выше */
  }
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
