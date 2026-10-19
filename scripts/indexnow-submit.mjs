#!/usr/bin/env node
// Сообщить поисковикам о новых страницах — протокол IndexNow.
//
//   node scripts/indexnow-submit.mjs            # все адреса из боевого sitemap
//   node scripts/indexnow-submit.mjs /a /b      # только указанные
//
// Зачем. С 16.10.2026 API Вебмастера не отвечает, а значит «Переобход
// страниц» — штатный способ позвать робота — недоступен. IndexNow это
// другой канал к тому же роботу: Яндекс его поддерживает, авторизация не
// по OAuth, а по файлу-ключу в корне сайта. 19.10 проверено: хост
// отвечает, в отличие от api.webmaster.yandex.net.
//
// Это подсказка, а не команда: робот решает сам, когда прийти. Но без неё
// новые страницы ждут планового обхода неделями, а у нас их 29 за три дня.
//
// Ключ лежит в public/<ключ>.txt и уезжает в сборку как обычный файл. Он не
// секрет — он лишь доказывает, что мы владеем сайтом: подделать отправку
// можно только с доступом к нашему домену.
import { readdirSync, readFileSync } from "node:fs";

const SITE = process.env.SITE || "https://xn----7sbhcltqolxje.xn--p1ai";
const PUBLIC = new URL("../public/", import.meta.url).pathname;

const keyFile = readdirSync(PUBLIC).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error("в public/ нет файла-ключа IndexNow (32 шестнадцатеричных символа + .txt)");
  process.exit(1);
}
const key = readFileSync(PUBLIC + keyFile, "utf8").trim();
if (key !== keyFile.replace(/\.txt$/, "")) {
  console.error("содержимое файла-ключа не совпадает с его именем — IndexNow такое отвергнет");
  process.exit(1);
}

// Ключ обязан быть ДОСТУПЕН на сайте: сервис придёт за ним сам.
const probe = await fetch(`${SITE}/${keyFile}`);
if (!probe.ok) {
  console.error(`ключ ${SITE}/${keyFile} отдаёт ${probe.status} — сначала выкладка, потом отправка`);
  process.exit(1);
}

let urls = process.argv.slice(2).map((p) => (p.startsWith("http") ? p : SITE + p));
if (!urls.length) {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
if (!urls.length) {
  console.error("нечего отправлять: в sitemap.xml нет адресов");
  process.exit(1);
}

// Адреса в карте сайта кириллические, а в теле запроса нужен тот же host,
// что и у ключа, — приводим к одному виду через URL (он даёт punycode).
const host = new URL(SITE).host;
urls = urls.map((u) => new URL(u).href.replace(new URL(u).host, host));

const body = { host, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls };
const res = await fetch("https://yandex.com/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(`IndexNow → ${res.status} ${res.statusText}${text ? ": " + text.slice(0, 200) : ""}`);
console.log(`отправлено адресов: ${urls.length}`);
// 200 и 202 — приняли. Остальное разбираем по тексту ответа.
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
