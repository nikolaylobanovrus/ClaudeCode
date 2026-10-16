#!/usr/bin/env node
// Внутренние ссылки сайта: куда они ведут и кто на кого ссылается.
//
//   npm run check:links      (после сборки и пререндера)
//
// Две вещи, каждая со своим поводом.
//
// 1. БИТЫЕ ССЫЛКИ. До 15.10.2026 nginx отдавал на любой несуществующий путь
//    главную страницу с кодом 200, и ссылка с опечаткой выглядела рабочей:
//    человек просто попадал «не туда». После перехода на честный 404 такая
//    ссылка — это настоящая страница «не найдено» посреди сайта. Проверять
//    их теперь обязательно, и дешевле всего — по готовой сборке.
//
// 2. СТРАНИЦЫ-СИРОТЫ. На /deklaraciya/instrukciya не вело НИ ОДНОЙ ссылки с
//    сайта: страница жила только в sitemap.xml. Для поисковика это сигнал
//    «второстепенная», для человека — страницы просто нет. Полгода этого
//    никто не замечал, потому что ни одна проверка не смотрела на связи
//    между страницами.
//
// Проверяется ГОТОВАЯ сборка, а не исходники: ссылка может приходить из
// шапки, подвала, текста страницы или пререндера — важно, что в итоге лежит
// на диске.
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { ROUTES, REDIRECTS, routeFile } from "../src/data/routes.js";

const DIST = new URL("../dist/", import.meta.url).pathname;
const problems = [];

// Все страницы сборки: маршруты, оболочки редиректов и 404.
async function pages() {
  const out = [];
  for (const r of ROUTES) out.push([r.path, routeFile(r.path)]);
  for (const [from] of REDIRECTS) out.push([from, routeFile(from)]);
  out.push(["404", "404.html"]);
  return out;
}

// Ссылки внутрь сайта: только href="/…". Внешние, mailto:, tel: и якоря
// нас здесь не касаются.
const LINK = /href="(\/[^"#]*)"/g;

const known = new Set(ROUTES.map((r) => r.path));
for (const [from] of REDIRECTS) known.add(from);

// Куда может вести внутренняя ссылка, кроме маршрута: файл в сборке
// (og-картинка, robots.txt, PDF-бланк и т.п.).
const isFile = (p) => existsSync(join(DIST, p.replace(/^\//, "")));

const inbound = new Map(); // путь → Set страниц-доноров
const all = await pages();

for (const [page, file] of all) {
  let html;
  try {
    html = await readFile(join(DIST, file), "utf8");
  } catch {
    problems.push(`${page} — нет файла dist/${file}`);
    continue;
  }
  for (const m of html.matchAll(LINK)) {
    const href = m[1].replace(/\/$/, "") || "/";
    const target = href.split("?")[0];
    if (!known.has(target) && !isFile(target)) {
      problems.push(`${page} — ссылка в никуда: ${target} (после этапа C это честный 404)`);
      continue;
    }
    if (!inbound.has(target)) inbound.set(target, new Set());
    if (target !== page) inbound.get(target).add(page);
  }
}

// Сироты. Смотрим на индексируемые страницы: именно их мы предлагаем
// поисковику в sitemap.xml, и именно им нужны входящие ссылки.
for (const r of ROUTES) {
  if (!r.index) continue;
  const donors = inbound.get(r.path);
  if (!donors || donors.size === 0)
    problems.push(
      `${r.path} — страница-сирота: на неё не ссылается ни одна страница сайта (есть только в sitemap.xml)`
    );
}

// Половины сайта связывать НЕ надо: «под ключ» переезжает на отдельный
// домен nalog-service.online (решение владельца 16.10.2026). Проверка
// существующие ссылки между половинами не трогает — она про сироты и битые
// адреса, — но и новых не требует.

for (const p of problems) console.log("✗ " + p);
const idx = ROUTES.filter((r) => r.index).length;
console.log(
  problems.length
    ? `\nПРОБЛЕМ: ${problems.length}`
    : `Ссылки в порядке: ${all.length} страниц, битых нет, у всех ${idx} индексируемых есть входящие.`
);
process.exit(problems.length ? 1 : 0);
