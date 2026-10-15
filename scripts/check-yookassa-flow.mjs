#!/usr/bin/env node
// Боевой путь оплаты целиком, в браузере: ЮKassa + поллинг статуса.
//
//   npm run check:yookassa
//
// Зачем отдельная проверка. check:wizard идёт по тестовому провайдеру: заказ
// «оплачивается» на месте, страница не покидается, поллинг не участвует. То
// есть ровно тот код, который работает за деньги, не проверялся НИКОГДА —
// а 15.10.2026 именно в нём исправлен автопереход к документам (до этого
// поллинг видел оплату, но человек оставался на экране ожидания и ждал, пока
// сам не нажмёт кнопку, хотя на экране обещано обратное).
//
// Что подменяется (и только это):
//   - edge-функция create-payment → отдаёт номер заказа и адрес «ЮKassa»;
//   - страница ЮKassa → простая заглушка с кнопкой «Оплатить», которая
//     возвращает на сайт, как настоящая;
//   - RPC get_order_status → два раза waiting, потом paid: так и выглядит
//     ожидание вебхука.
// Код сайта не подменяется ничем: провайдер в сборке — боевой (yookassa).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
               ".svg": "image/svg+xml", ".pdf": "application/pdf", ".ttf": "font/ttf",
               ".json": "application/json", ".png": "image/png", ".txt": "text/plain; charset=utf-8" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  const file = path === "/" ? "index.html" : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    try {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(await readFile(join(ROOT, "index.html")));
    } catch {
      res.writeHead(404).end("нет dist/ — соберите: npm run check:yookassa");
    }
  }
});
// Сборка в dist обязана быть БОЕВОЙ по провайдеру оплаты. Иначе проверка
// молча проверяет не то: в тестовом режиме кнопка «оплачивает» на месте, со
// страницы никто не уходит, и весь смысл этой проверки пропадает. Признак —
// вызов edge-функции create-payment в бандле (так же проверяет публикация).
{
  const dir = join(ROOT, "assets");
  const names = await readdir(dir).catch(() => []);
  let found = false;
  for (const n of names.filter((n) => n.endsWith(".js"))) {
    const text = await readFile(join(dir, n), "utf8").catch(() => "");
    if (text.includes("create-payment")) { found = true; break; }
  }
  if (!found) {
    console.log("В dist нет вызова create-payment — собрано в тестовом режиме.");
    console.log("Соберите вместе с проверкой: npm run check:yookassa");
    process.exit(2);
  }
}

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

let failures = 0;
const fail = (m) => { failures++; console.log("   ✗ " + m); };
const ok = (m) => console.log("   ✓ " + m);
const heading = (p) => p.locator(".wiz__heading").first().innerText();

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const goals = [];
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.exposeFunction("__goal", (n, p) => goals.push([n, p]));
await page.addInitScript(() => {
  window.ym = (id, act, name, params) => { if (act === "reachGoal") window.__goal(name, params); };
});

// --- Подмена сервера оплаты -------------------------------------------------
let polls = 0;            // сколько раз спросили статус
const pollLog = [];       // { at, status } — по этому видно дубли поллинга
// Когда человек вернулся с кассы. Вебхук ЮKassa приходит не мгновенно:
// до WEBHOOK_MS отдаём waiting, после — paid. Считать опросы нельзя: шаг
// оплаты опрашивает статус и ДО ухода на кассу, и тот опрос съедал бы счётчик.
let returnedAt = 0;
const WEBHOOK_MS = 4000;
let created = 0;          // сколько заказов создано
const json = (route, body) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

// Страховка: НИ ОДИН запрос к боевому Supabase не должен уйти наружу.
// Правило стоит первым — у Playwright позже добавленные маршруты имеют
// приоритет, поэтому подмены ниже перекрывают этот обрыв, а всё, что не
// подменено, просто не уедет. Это даёт право запускать проверку и на боевой
// сборке (её и публикуем), не создавая реальных заказов.
await page.route("**://*.supabase.co/**", (route) => route.abort());
await page.route("**://sb.stand.test/**", (route) => route.abort());

await page.route("**/functions/v1/create-payment", (route) => {
  created++;
  return json(route, { orderId: "stand-order-1", amount: 199, confirmationUrl: BASE + "/yookassa-stand" });
});
// Один обработчик на все RPC: у Playwright позже добавленный маршрут имеет
// приоритет, поэтому два отдельных правила легко перекрывают друг друга и
// проверка молча проходит мимо нужного запроса.
await page.route("**/rest/v1/rpc/**", (route) => {
  const fn = new URL(route.request().url()).pathname.split("/").pop();
  if (fn !== "get_order_status") return json(route, null);
  polls++;
  const status =
    returnedAt && Date.now() - returnedAt > WEBHOOK_MS ? "paid" : "waiting";
  pollLog.push({ at: Date.now(), status });
  return json(route, { status });
});
// Адрес возврата — ТОЧНО такой, какой ставит edge-функция create-payment:
// «/?order=<id>#/deklaraciya/anketa». Решётка в нём осталась с прежнего
// роутера: параметр обязан стоять ДО неё, иначе его не видно при хеш-сборке.
// Проверять надо именно эту строку: по ней анкета понимает, что человек
// вернулся с оплаты, а не бросил заполнение. Чистый адрес вместо неё даёт
// «незаконченную анкету от <дата>» и кнопку «Продолжить» — то есть
// заплативший человек видит не свои документы, а предложение начать заново.
const RETURN_URL = `${BASE}/?order=stand-order-1#/deklaraciya/anketa`;

// Заглушка «страницы ЮKassa»: отдельный документ, как у настоящей — то есть
// вкладка уходит с сайта, память JS теряется, черновик остаётся в хранилище.
await page.route(BASE + "/yookassa-stand", (route) =>
  route.fulfill({ status: 200, contentType: MIME[".html"], body:
    `<!doctype html><meta charset=utf-8><title>Касса (заглушка)</title>
     <h1>Оплата 199 ₽</h1>
     <button id=pay onclick="location.href='${RETURN_URL}'">Оплатить</button>` })
);

const fillOn = async (pg, label, v) => {
  const f = pg.locator(".form__field", { hasText: label }).first();
  if (!(await f.count())) { fail(`поле «${label}» не найдено`); return; }
  await f.locator("input").first().fill(String(v));
};
const nextOn = async (pg, what) => {
  const btn = pg.locator("button.btn--primary", { hasText: /Далее|Всё верно/ }).first();
  if (!(await btn.count())) { fail(`нет кнопки «Далее» (${what})`); return false; }
  await btn.click();
  await pg.waitForTimeout(500);
  return true;
};
const fill = (label, v) => fillOn(page, label, v);
const next = (what) => nextOn(page, what);

// Анкета «продал автомобиль» — самая короткая до шага оплаты.
async function fillCarSale(pg) {
  await pg.waitForSelector(".wiz__heading", { timeout: 20000 });
  await pg.locator(".wiz__type", { hasText: "Продал автомобиль" }).first().click();
  if (!(await nextOn(pg, "ситуация→продажа"))) return false;
  await fillOn(pg, "Цена продажи", "600000");
  await fillOn(pg, "Дата продажи", "2025-06-10");
  await fillOn(pg, "Покупатель (ФИО)", "Петров Пётр Петрович");
  if (!(await nextOn(pg, "продажа→о вас"))) return false;
  await fillOn(pg, "Фамилия", "Иванов");
  await fillOn(pg, "Имя", "Пётр");
  await fillOn(pg, "ИНН", "500100732259");
  await fillOn(pg, "Код инспекции (ИФНС)", "7447");
  await fillOn(pg, "ОКТМО", "75701000");
  await fillOn(pg, "Телефон", "+79120000000");
  if (!(await nextOn(pg, "о вас→проверка"))) return false;
  if (!(await nextOn(pg, "проверка→оплата"))) return false;
  return true;
}

// Кнопки выдачи документов появляются, когда комплект собран.
async function docButtons(pg) {
  const btns = pg.locator("button, a").filter({ hasText: /Скачать|декларац|XML|Заявление|Инструкц/i });
  await btns.nth(1).waitFor({ timeout: 60000 }).catch(() => {});
  return btns.count();
}

console.log("=== боевой путь: ЮKassa + поллинг ===");
await page.goto(BASE + "/deklaraciya/anketa");
if (!(await fillCarSale(page))) process.exit(1);
if (!/оплат/i.test(await heading(page))) { fail("не дошли до шага оплаты"); process.exit(1); }
ok("дошли до шага оплаты (провайдер в сборке — боевой)");

// Оплата: уход на «ЮKassa» и возврат, как у настоящего плательщика.
const payBtn = page.locator("button.btn--primary", { hasText: /Оплатить|Я оплатил/ }).first();
if (!(await payBtn.count())) { fail("на экране оплаты нет кнопки оплаты"); process.exit(1); }
await Promise.all([page.waitForURL(/yookassa-stand/, { timeout: 20000 }), payBtn.click()]);
ok("кнопка увела на страницу кассы" + (created === 1 ? "" : ` (заказов создано: ${created})`));
if (created !== 1) fail(`create-payment вызван ${created} раз(а), ожидался один`);

// На странице кассы человек вводит карту — не мгновение.
await page.waitForTimeout(1500);
await Promise.all([
  page.waitForURL(/deklaraciya\/anketa/, { timeout: 20000 }),
  page.locator("#pay").click(),
]);
returnedAt = Date.now();
await page.waitForSelector(".wiz__heading", { timeout: 20000 });
// Шим должен был превратить «/?order=…#/deklaraciya/anketa» в чистый адрес,
// СОХРАНИВ ?order= — без него анкета не узнает возврат с оплаты.
const url = page.url();
if (!/\/deklaraciya\/anketa\?order=stand-order-1/.test(url))
  fail(`адрес после возврата с кассы потерял ?order=: ${url}`);
else ok("адрес возврата приведён к чистому, номер заказа сохранён");
const afterReturn = await heading(page);
if (!/оплат/i.test(afterReturn)) fail(`после возврата с кассы ожидался шаг оплаты, а не «${afterReturn}»`);
else ok("после возврата с кассы человек на шаге оплаты, анкета на месте");

// Пока статус waiting — никуда уводить нельзя: вебхук ещё не пришёл.
await page.waitForTimeout(WEBHOOK_MS - 1000);
const whileWaiting = await heading(page);
if (!/оплат/i.test(whileWaiting)) fail(`пока статус waiting, экран уже ушёл на «${whileWaiting}»`);
else ok("пока оплата не подтверждена — экран ожидания, документы не открыты");

// Третий опрос отдаёт paid: документы должны открыться САМИ.
await page.waitForFunction(
  () => /документ/i.test(document.querySelector(".wiz__heading")?.textContent || ""),
  null, { timeout: 30000 }
).catch(() => {});
const h = await heading(page);
if (!/документ/i.test(h)) {
  fail(`поллинг увидел оплату, но документы не открылись сами: «${h}» (опросов: ${polls})`);
} else {
  ok(`документы открылись САМИ после подтверждения оплаты (опросов статуса: ${polls})`);
  // Заголовок шага появляется сразу, а кнопки — когда комплект собран
  // (pdf-lib, шрифты, бланк). Ждём именно кнопки: человеку нужны они.
  const t0 = Date.now();
  const docs = await docButtons(page);
  if (docs < 2) fail(`на «Документах» слишком мало кнопок выдачи: ${docs}`);
  else ok(`комплект собран за ${((Date.now() - t0) / 1000).toFixed(1)} с, кнопок выдачи: ${docs}`);
}

// Оплата должна быть зафиксирована: цель Метрики и покупка в e-commerce.
// Если автопереход срабатывает раньше — шаг размонтируется, и в отчётах
// платёж исчезает (а деньги списаны).
const paidGoal = goals.find((g) => g[0] === "wizard_paid");
if (!paidGoal) fail("цель wizard_paid не отправлена — оплата не попала в отчёты");
else ok(`цель wizard_paid отправлена (${JSON.stringify(paidGoal[1])})`);
if (!goals.some((g) => g[0] === "wizard_order")) fail("цель wizard_order не отправлена");
else ok("цель wizard_order отправлена");

// Поллинг должен быть ОДИН: два параллельных опроса — двойная нагрузка на
// базу и, в боевом режиме, двойной расход лимитов Supabase.
// Сравниваем только опросы, вернувшие waiting: это строго поллинг шага
// оплаты. Последний (paid) дублируется проверкой на шаге «Документы» — там
// запрос законный, он сверяет оплату перед выдачей.
const waits = pollLog.filter((p) => p.status === "waiting").map((p) => p.at);
const gaps = waits.slice(1).map((t, i) => t - waits[i]);
if (gaps.some((g) => g < 1500))
  fail("опросы статуса идут чаще, чем раз в 3 с — похоже, поллинг запущен дважды: "
       + gaps.map((g) => (g / 1000).toFixed(1)).join(", ") + " с");
else ok("опрос статуса идёт один раз в ~3 с, дублей нет (" + gaps.map((g) => (g / 1000).toFixed(1)).join(", ") + " с)");

const crash = goals.filter((g) => g[0] === "render_error");
if (crash.length) fail("СБОЙ РЕНДЕРА: " + JSON.stringify(crash[0][1]));
else ok("сбоев рендера нет");
if (errors.length) fail("ошибки страницы: " + errors.slice(0, 2).join(" | "));
else ok("консоль чистая");

await ctx.close();

// --- Сценарий 2: оператор --------------------------------------------------
// Оператор формирует документы без оплаты (RPC operator_paid_order), и его
// кнопка обещает «сформировать документы». Путь проверяется впервые: до
// 15.10.2026 после кнопки появлялся ещё один экран с ещё одной кнопкой, и
// оператор делал этот лишний клик на каждой анкете.
console.log("\n=== режим оператора: документы без оплаты ===");
const opCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const opPage = await opCtx.newPage();
const opGoals = [];
const opErrors = [];
opPage.on("pageerror", (e) => opErrors.push("pageerror: " + e.message));
await opPage.exposeFunction("__goal", (n, p) => opGoals.push([n, p]));
let opOrders = 0;
await opPage.addInitScript(() => {
  window.ym = (id, act, name, params) => { if (act === "reachGoal") window.__goal(name, params); };
  // Живая сессия оператора: токен Supabase Auth с запасом по сроку.
  // expires_at — абсолютный момент в МИЛЛИсекундах (см. lib/supabase.js):
  // в секундах он выглядит как давно истёкший, и оператора не видно.
  localStorage.setItem("ns.op.session", JSON.stringify({
    access_token: "stand-operator-token",
    refresh_token: "stand-refresh",
    expires_at: Date.now() + 3600_000,
  }));
});
await opPage.route("**://*.supabase.co/**", (route) => route.abort());
await opPage.route("**://sb.stand.test/**", (route) => route.abort());
await opPage.route("**/rest/v1/rpc/**", (route) => {
  const fn = new URL(route.request().url()).pathname.split("/").pop();
  if (fn === "operator_paid_order") { opOrders++; return json(route, "op-order-1"); }
  // Заказ оператора в базе реально оплачен (amount 0) — шаг «Документы»
  // проверяет его так же строго, как любой другой.
  if (fn === "get_order_status") return json(route, { status: "paid" });
  return json(route, null);
});

await opPage.goto(BASE + "/deklaraciya/anketa");
if (!(await fillCarSale(opPage))) fail("оператор не дошёл до шага оплаты");
else {
  const opBtn = opPage.locator("button.btn--primary", { hasText: /без оплаты/ }).first();
  if (!(await opBtn.count())) fail("оператор не видит кнопку «Сформировать документы без оплаты»");
  else {
    ok("оператор видит кнопку формирования без оплаты (карточки оплаты нет)");
    await opBtn.click();
    await opPage.waitForFunction(
      () => /документ/i.test(document.querySelector(".wiz__heading")?.textContent || ""),
      null, { timeout: 30000 }
    ).catch(() => {});
    const oh = await heading(opPage);
    if (!/документ/i.test(oh)) fail(`у оператора документы не открылись сами: «${oh}»`);
    else {
      ok("документы открылись САМИ, без второго клика");
      const n = await docButtons(opPage);
      if (n < 2) fail(`у оператора слишком мало кнопок выдачи: ${n}`);
      else ok(`кнопок выдачи документов: ${n}`);
    }
    if (opOrders !== 1) fail(`operator_paid_order вызван ${opOrders} раз(а), ожидался один`);
    else ok("заказ оператора создан один раз");
    // Оператор — не продажа. Если его считать конверсией, отчёты по рекламе
    // покажут оплаты, которых не было, и ставки будут назначены по вранью.
    if (opGoals.some((g) => g[0] === "wizard_paid")) fail("оператор посчитан как оплата (цель wizard_paid)");
    else ok("оператор не посчитан конверсией — цели wizard_paid нет");
  }
}
if (opGoals.some((g) => g[0] === "render_error")) fail("СБОЙ РЕНДЕРА у оператора");
else ok("сбоев рендера нет");
if (opErrors.length) fail("ошибки страницы у оператора: " + opErrors.slice(0, 2).join(" | "));
else ok("консоль чистая");
await opCtx.close();

await browser.close();
server.close();
console.log(
  failures
    ? `\nПРОВАЛОВ: ${failures}`
    : "\nОба пути к документам работают сами: и оплата, и режим оператора."
);
process.exit(failures ? 1 : 0);
