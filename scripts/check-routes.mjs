#!/usr/bin/env node
// Списки страниц в App.jsx и в routes.js обязаны совпадать.
//
//   npm run check:routes
//
// Зачем. После перехода на чистые URL каждая страница существует в dist как
// настоящий файл, а nginx отдаёт 404 на всё остальное. Значит маршрут,
// добавленный в App.jsx и забытый в routes.js, перестанет пререндериться — и
// живой человек получит по нему не сайт, а страницу «не найдено». Молча.
//
// Обратный случай не опаснее, но так же вреден: путь, оставшийся в routes.js
// после удаления из App.jsx, попадёт в sitemap, и поисковик пойдёт по нему
// в 404.
//
// Поэтому список сверяется механически, а проверка стоит в выкладке
// (publish-dist.sh) до сборки.
import { readFileSync } from "node:fs";
import { ROUTES, REDIRECTS } from "../src/data/routes.js";

const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

// Достаём пути из <Route path="..."> и отдельно индексный маршрут.
// Разбор текстом, а не импортом: App.jsx — JSX, node его не исполнит, а
// тащить ради проверки сборщик значит проверять уже не то, что написано.
const declared = new Set();
if (/<Route\s+index\b/.test(src)) declared.add("/");
for (const m of src.matchAll(/<Route\s+[^>]*?path="([^"]+)"/g)) {
  const p = m[1];
  if (p === "*" || p === "/") continue; // «всё остальное» и корневой Layout
  declared.add("/" + p.replace(/^\//, ""));
}

const known = new Set([...ROUTES.map((r) => r.path), ...REDIRECTS.map(([from]) => from)]);

const missing = [...declared].filter((p) => !known.has(p)); // есть в App.jsx, нет в routes.js
const extra = [...known].filter((p) => !declared.has(p)); // есть в routes.js, нет в App.jsx

for (const p of missing)
  console.log(`✗ ${p} — есть в App.jsx, но нет в routes.js: страница не попадёт в пререндер и станет 404`);
for (const p of extra)
  console.log(`✗ ${p} — есть в routes.js, но нет в App.jsx: попадёт в sitemap и уведёт поисковик в 404`);

// Мелочи, которые ломают пререндер и sitemap молча.
const bad = [];
for (const r of ROUTES) {
  if (!r.path.startsWith("/")) bad.push(`${r.path} — путь должен начинаться со слеша`);
  if (r.path !== "/" && r.path.endsWith("/")) bad.push(`${r.path} — лишний слеш на конце`);
  if (r.index && !r.priority) bad.push(`${r.path} — индексируемая страница без priority`);
}
for (const b of bad) console.log("✗ " + b);

const problems = missing.length + extra.length + bad.length;
console.log(
  problems
    ? `\nРАСХОЖДЕНИЙ: ${problems}`
    : `Списки сошлись: ${ROUTES.length} страниц (${ROUTES.filter((r) => r.index).length} индексируемых) + ${REDIRECTS.length} редирект.`
);
process.exit(problems ? 1 : 0);
