#!/usr/bin/env node
// Старые адреса с решёткой обязаны продолжать работать.
//
//   npm run check:shim
//
// Зачем это главная проверка перехода на чистые URL. На «#/»-адреса ведут
// 109 действующих объявлений Директа, ссылки в уже скачанных людьми
// PDF-инструкциях, закладки и возврат с ЮKassa. Перемодерировать объявления
// ради переезда нельзя — это дни простоя. Значит переход держится ровно на
// одном файле (scripts/hash-url-shim.js), и цена его ошибки — весь платный
// трафик.
//
// Проверяем не «сработал ли шим», а то, ради чего он нужен: человек с каждой
// живой ссылки попадает туда же, куда попадал вчера, с теми же параметрами.
import { serveDist, launchChromium, blockExternals } from "./_serve-dist.mjs";

const { base, close } = await serveDist({ fallback: "404" });
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await blockExternals(ctx);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) console.log(`      получили: ${actual}\n      ожидали:  ${expected}`);
};

// Код ссылки-черновика: base64 с «+» и «/» — именно те символы, которые
// URLSearchParams превратил бы в пробел и порчу. Ради них склейка в шиме
// сделана строками.
const DRAFT = encodeURIComponent("eyJhIjoi0J/RgNC+0LIiLCJiIjoiYSt+b/YyJ9");

const CASES = [
  ["главная с метками", "/?utm_source=yandex&utm_medium=cpc#/", "/?utm_source=yandex&utm_medium=cpc"],
  ["старый лендинг (88 объявлений)", "/?utm_source=yandex#/deklaraciya", "/?utm_source=yandex"],
  ["анкета из объявления", "/?utm_source=yandex#/deklaraciya/anketa", "/deklaraciya/anketa?utm_source=yandex"],
  ["возврат с ЮKassa", "/?order=11111111-1111-4111-8111-111111111111#/deklaraciya/anketa",
    "/deklaraciya/anketa?order=11111111-1111-4111-8111-111111111111"],
  ["ссылка-черновик", `/?d=${DRAFT}#/deklaraciya/anketa`, `/deklaraciya/anketa?d=${DRAFT}`],
  ["предвыбор ситуации", "/?s=lechenie#/deklaraciya/anketa", "/deklaraciya/anketa?s=lechenie"],
  ["уточнёнка из рекламы", "/?korr=1#/deklaraciya/anketa", "/deklaraciya/anketa?korr=1"],
  ["перенос из калькулятора",
    "/?s=prodazha_realty&obj=flat&price=4000000&cad=3000000&acq=2023-01-10&sold=2025-06-10#/deklaraciya/anketa",
    "/deklaraciya/anketa?s=prodazha_realty&obj=flat&price=4000000&cad=3000000&acq=2023-01-10&sold=2025-06-10"],
  ["хвост через & (Telega.in)", "/#/deklaraciya&erid=abc123", "/?erid=abc123"],
  ["калькулятор из объявления", "/#/deklaraciya/kalkulyator-naloga-s-prodazhi",
    "/deklaraciya/kalkulyator-naloga-s-prodazhi"],
  ["чистый адрес не трогаем", "/deklaraciya/instrukciya", "/deklaraciya/instrukciya"],
  ["чистый адрес с метками", "/deklaraciya/anketa?utm_source=x", "/deklaraciya/anketa?utm_source=x"],
];

console.log("=== старые ссылки приводят туда же, куда и раньше ===");
for (const [label, from, want] of CASES) {
  const page = await ctx.newPage();
  // Считаем НАСТОЯЩИЕ загрузки документа. framenavigated для этого не годится:
  // он срабатывает и на replaceState, которым шим и правит адрес, — на нём я
  // и попался, получив «перезагрузилась 3 раза» там, где её не было.
  let loads = 0;
  page.on("load", () => loads++);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  try {
    await page.goto(base + from, { waitUntil: "load", timeout: 20000 });
    await page.waitForSelector(".site__main", { timeout: 20000 });
    const got = await page.evaluate(() => location.pathname + location.search);
    check(label, got, want);
    if (errors.length) {
      failures++;
      console.log(`      ✗ ошибка на странице: ${errors[0]}`);
    }
    // Шим правит адрес через replaceState — перезагрузки быть не должно,
    // иначе человек с рекламы платит вторым запросом и мигающим экраном.
    if (loads > 1) {
      failures++;
      console.log(`      ✗ страница перезагрузилась ${loads} раз(а)`);
    }
  } catch (e) {
    failures++;
    console.log(`✗ ${label} — не открылась: ${String(e.message).slice(0, 100)}`);
  }
  await page.close();
}

// Ситуация из ссылки должна реально доехать до анкеты, а не просто остаться
// в адресе: именно ради этого объявления и размечены ?s=.
console.log("\n=== параметры доезжают до приложения ===");
{
  const page = await ctx.newPage();
  await page.goto(base + "/?s=lechenie#/deklaraciya/anketa", { waitUntil: "load", timeout: 20000 });
  await page.waitForSelector(".site__main", { timeout: 20000 });
  const checked = await page
    .locator('input[type="checkbox"]:checked, [aria-pressed="true"], .is-on, .wiz__tile--on')
    .count();
  const ok = checked > 0;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ?s=lechenie отметил ситуацию в анкете (отмечено: ${checked})`);
  await page.close();
}

await browser.close();
await close();
console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nВсе старые ссылки работают.");
process.exit(failures ? 1 : 0);
