#!/usr/bin/env node
// Картинки для превью ссылок (Open Graph) — из SVG в PNG.
//
//   node scripts/build-og-image.mjs
//
// Рисует PNG для КАЖДОГО файла public/og-*.svg. Сейчас их два:
//   og-sam        — самозаполнение за 199 ₽ (главная и весь /deklaraciya);
//   og-pod-klyuch — услуга «под ключ» (/pod-klyuch и соседние страницы).
// Какая страница какую показывает — ogImageFor() в src/data/routes.js.
//
// Зачем вообще PNG. До 15.10.2026 og:image указывал на og-image.svg. Картинка
// была и отдавалась с кодом 200, но превью в формате SVG не поддерживает
// никто из тех, кому оно адресовано: ни WhatsApp, ни Telegram, ни ВКонтакте,
// ни Facebook, ни X, ни Яндекс в сниппетах. Все ждут растр. В итоге
// пересланная ссылка показывала заголовок с описанием и пустое место вместо
// картинки — а услугу за 199 ₽ люди пересылают друг другу именно ссылкой.
//
// Почему рисуем ИЗ SVG, а не заново. Дизайн остаётся единственным: правка в
// SVG — и PNG перерисовывается этой командой. Два независимых исходника
// разошлись бы в первый же месяц.
//
// Про шрифт. В SVG стоит Arial, которого в Linux нет; fontconfig подставляет
// Liberation Sans — он метрически совпадает с Arial, поэтому разметка
// получается ровно такая, какую видит человек с Arial.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { launchChromium } from "./_serve-dist.mjs";

const PUBLIC = new URL("../public/", import.meta.url).pathname;
const W = 1200;
const H = 630; // 1200×630 — размер, который ждут все площадки (OG, 1.91:1)

const names = (await readdir(PUBLIC))
  .filter((n) => /^og-.*\.svg$/.test(n))
  .sort();
if (!names.length) {
  console.error("в public/ нет ни одного og-*.svg");
  process.exit(1);
}

const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

let bad = 0;
for (const name of names) {
  const svg = await readFile(PUBLIC + name, "utf8");
  // Страница ровно по размеру картинки, без полей и скроллов: снимок окна
  // тогда совпадает с картинкой пиксель в пиксель.
  await page.setContent(
    `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden}` +
      `svg{display:block}</style>${svg}`,
    { waitUntil: "load" }
  );
  await page.evaluateHandle("document.fonts.ready");
  const png = await page.screenshot({ type: "png" });

  // Размер проверяем по самому файлу (IHDR в первых 24 байтах), а не по тому,
  // что мы просили у браузера: мета-теги og:image:width/height обязаны
  // совпадать с настоящим файлом, иначе площадка покажет обрезанную карточку.
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (w !== W || h !== H) {
    console.error(`✗ ${name}: получилось ${w}×${h}, ожидалось ${W}×${H}`);
    bad++;
    continue;
  }
  const out = name.replace(/\.svg$/, ".png");
  await writeFile(PUBLIC + out, png);
  console.log(`✓ public/${out} — ${w}×${h}, ${(png.length / 1024).toFixed(0)} КБ`);
}

await browser.close();
process.exit(bad ? 1 : 0);
