#!/usr/bin/env node
// Сквозной проход анкеты в браузере: четыре сценария до готовых документов.
//
//   VITE_HASH_ROUTER=1 VITE_SB_URL=http://127.0.0.1:9 npm run build
//   npx http-server dist -p 8781   (или python3 -m http.server 8781 из dist)
//   npm run check:wizard
//
// Зачем. 10.09.2026 шаг «Расходы» падал у вернувшихся с сохранённым
// черновиком: «Далее» не работало, ошибок не было, в отчётах это выглядело
// как «передумал». Поломка прожила сутки. Ни одна имевшаяся проверка её не
// ловила: схемы ФНС проверяют XML, check:hscroll — вёрстку, а то, что человек
// физически не может дойти до оплаты, не проверял никто.
//
// Стенд глушит боевую базу двумя способами сразу (мёртвый VITE_SB_URL при
// сборке и обрыв запросов к *.supabase.co в браузере) — заказы в проде не
// создаются. Оплата идёт по mock-провайдеру.
//
// Проверяется на каждом шаге: «Далее» действительно уводит дальше, экран не
// пустой, цель render_error не сработала, консоль чистая.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8781";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

let failures = 0;
const fail = (m) => { failures++; console.log("   ✗ " + m); };
const ok = (m) => console.log("   ✓ " + m);

async function newPage(width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], goals = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const t = m.text();
    // Обрыв до заглушенной базы — это стенд, а не дефект сайта.
    if (m.type() === "error" && !/ERR_UNSAFE_PORT|ERR_CONNECTION|Failed to load resource/.test(t))
      errors.push("console: " + t.slice(0, 160));
  });
  await page.exposeFunction("__goal", (n, p) => goals.push([n, p]));
  await page.addInitScript(() => {
    window.ym = (id, act, name, params) => { if (act === "reachGoal") window.__goal(name, params); };
  });
  await page.route("**://*.supabase.co/**", (r) => r.abort());
  return { ctx, page, errors, goals };
}

const heading = (p) => p.locator(".wiz__heading").first().innerText();

async function clickNext(page, label) {
  const before = await heading(page);
  await page.locator(".wiz__nav button.btn--primary").click();
  await page.waitForTimeout(400);
  const after = await heading(page);
  if (after === before) {
    const n = await page.locator("p.form__error[role=alert]").count();
    const msg = n ? (await page.locator("p.form__error[role=alert]").allInnerTexts()).join(" | ").replace(/\s+/g, " ") : "СООБЩЕНИЯ НЕТ";
    const blank = !(await page.locator(".wiz__main").innerText()).trim();
    // Какие именно поля покраснели — иначе «не заполнено: 14» ни о чём.
    const bad = (await page.locator(".form__field.has-error label").allInnerTexts())
      .map((t) => t.replace(/\s+/g, " ").trim()).slice(0, 20);
    fail(`«Далее» не увело с «${before}»${blank ? " (экран ПУСТОЙ)" : ""} → ${msg}`);
    if (bad.length) console.log("      покраснели: " + bad.join(" · "));
    return false;
  }
  ok(`${label}: «${before}» → «${after}»`);
  return true;
}

async function fill(page, label, value) {
  const f = page.locator(".form__field", { hasText: label }).first();
  const input = f.locator("input").first();
  if (!(await input.count())) { fail(`поле «${label}» не найдено`); return; }
  await input.fill(String(value));
}

// Одинаковые подписи встречаются в трёх блоках сразу (сбережения, ИИС,
// страхование) — выбираем по порядку в документе.
async function fillNth(page, label, index, value) {
  const f = page.locator(".form__field").filter({ hasText: label }).nth(index);
  if (!(await f.count())) { fail(`поле «${label}» №${index} не найдено`); return; }
  await f.locator("input").first().fill(String(value));
}

async function tiles(page, titles) {
  for (const t of titles) {
    const tile = page.locator(".wiz__type", { hasText: t }).first();
    if (!(await tile.count())) { fail(`плитка «${t}» не найдена`); continue; }
    await tile.click();
  }
}

const INCOME = async (page) => {
  await fill(page, "Название организации", "ООО «Ромашка»");
  await fill(page, "ИНН работодателя", "7420010847");
  await fill(page, "КПП", "741501001");
  await fill(page, "ОКТМО работодателя", "75701000");
  await fill(page, "Общая сумма дохода", "1200000");
  await fill(page, "Налог удержанный", "156000");
};

const PERSONAL = async (page) => {
  await fill(page, "Фамилия", "Иванов");
  await fill(page, "Имя", "Пётр");
  await fill(page, "ИНН", "500100732259");
  await fill(page, "Код инспекции (ИФНС)", "7447");
  await fill(page, "ОКТМО", "75701000");
  await fill(page, "Телефон", "+79120000000");
};

const BANK = async (page) => {
  await fill(page, "БИК банка", "047501711");
  await fill(page, "Номер счёта", "40702810007710002545");
};

async function payAndDocs(page) {
  // Экран оплаты: mock-провайдер, кнопка создаёт заказ и сразу «оплачивает».
  const payBtn = page.locator("button.btn--primary", { hasText: /Оплатить|Я оплатил/ }).first();
  if (!(await payBtn.count())) { fail("на экране оплаты нет кнопки оплаты"); return; }
  await payBtn.click();
  await page.waitForTimeout(1800);
  // После «оплаты» экран меняется: нужен ещё один клик по кнопке перехода.
  if (/оплат/i.test(await heading(page))) {
    const go = page.locator("button.btn--primary").first();
    if (await go.count()) { await go.click(); await page.waitForTimeout(1200); }
  }
  const h = await heading(page);
  if (!/документ/i.test(h)) { fail(`после оплаты ожидались «Документы», получили «${h}»`); return; }
  ok("оплата прошла, открылись «Документы»");
  const docs = await page.locator("button, a").filter({ hasText: /Скачать|декларац|XML|Заявление|Инструкц/i }).count();
  if (docs < 2) fail(`на «Документах» слишком мало кнопок выдачи: ${docs}`);
  else ok(`кнопок выдачи документов: ${docs}`);
}

async function run(name, scenario, width) {
  console.log("\n=== " + name);
  const { ctx, page, errors, goals } = await newPage(width);
  await page.goto(BASE + "/#/deklaraciya/anketa");
  await page.waitForSelector(".wiz__heading", { timeout: 15000 });
  try { await scenario(page); }
  catch (e) { fail("сценарий оборвался: " + e.message.slice(0, 200)); }
  const crash = goals.filter((g) => g[0] === "render_error");
  if (crash.length) fail("СБОЙ РЕНДЕРА: " + JSON.stringify(crash[0][1]));
  else ok("сбоев рендера нет");
  if (errors.length) fail("ошибки страницы: " + errors.slice(0, 2).join(" | "));
  else ok("консоль чистая");
  await ctx.close();
}

// --- 1. Возврат: все девять вычетов ---------------------------------------
await run("Возврат: все девять вычетов", async (page) => {
  await tiles(page, ["Купили квартиру или дом", "Платили за ипотеку", "Платили за лечение",
                     "Платили за обучение", "Открыли инвестиционный счёт",
                     "Платили за страхование жизни", "Платили за спорт и фитнес",
                     "Есть дети", "Программа долгосрочных сбережений"]);
  if (!(await clickNext(page, "шаг 1→2"))) return;
  await INCOME(page);
  if (!(await clickNext(page, "шаг 2→3"))) return;

  await fill(page, "Адрес объекта", "г. Челябинск, ул. Ленина, д. 1");
  await fill(page, "Стоимость жилья", "2500000");
  await fill(page, "Дата регистрации права", "2024-03-15");
  await fill(page, "Проценты, уплаченные банку", "250000");
  await fill(page, "Обычное лечение и лекарства", "60000");
  await fill(page, "Своё обучение", "40000");
  await fill(page, "Взносы на ИИС", "100000");
  // Реквизиты ИИС и страховой — по секциям, чтобы не путать одноимённые поля
  const iis = page.locator("section.wiz__block", { hasText: "📈 ИИС" }).first();
  await iis.locator('input[type="text"]').first().fill("АО «Брокер»");
  const ins = page.locator("section.wiz__block", { hasText: "Страхование жизни" }).first();
  await ins.locator("input").first().fill("50000");
  // Долгосрочные сбережения: договор добавляется кнопкой, иначе шаг не пустит
  // (валидация требует реквизиты для листа «Расчёт к Приложению 5»).
  const sv = page.locator("section.wiz__block", { hasText: "Долгосрочные сбережения" }).first();
  await sv.locator("button", { hasText: "Добавить договор" }).click();
  await page.waitForTimeout(200);
  const row = sv.locator(".wiz__block").first();
  const ins2 = row.locator("input");
  await ins2.nth(0).fill("80000");                 // взносы за год
  await ins2.nth(1).fill("НПФ «Будущее»");         // название
  await ins2.nth(2).fill("7725039953");            // ИНН
  await ins2.nth(3).fill("772501001");             // КПП
  await ins2.nth(4).fill("2025-02-20");            // дата договора
  await ins2.nth(5).fill("ПДС-1");                 // номер договора
  // Дети: очерёдность задаётся кнопкой «Добавить ребёнка»
  const kids = page.locator("section.wiz__block", { hasText: "Вычет на детей" }).first();
  const addKid = kids.locator("button", { hasText: /Добавить ребён/ });
  if (await addKid.count()) { await addKid.click(); await page.waitForTimeout(150); }
  // ИИС (второй блок с реквизитами договора) и страхование (третий)
  await fill(page, "Взносы на ИИС за", "100000");
  await fill(page, "Название брокера", "АО «Брокер»");
  await fillNth(page, "ИНН", 1, "7710140679");
  await fillNth(page, "КПП", 1, "771001001");
  await fillNth(page, "Дата договора", 1, "2023-02-10");
  await fillNth(page, "Номер договора", 1, "ИИС-1");
  await fill(page, "Дата открытия счёта", "2023-02-12");
  await fill(page, "Название страховой организации", "ООО «СК Жизнь»");
  await fillNth(page, "Взносы за год", 1, "50000");
  await fillNth(page, "ИНН", 2, "7702070139");
  await fillNth(page, "КПП", 2, "770201001");
  await fillNth(page, "Дата договора", 2, "2020-05-14");
  await fillNth(page, "Номер договора", 2, "Ж-1");
  await fill(page, "Расходы на спорт", "30000");
  if (!(await clickNext(page, "шаг 3→4"))) return;

  await PERSONAL(page);
  if (!(await clickNext(page, "шаг 4→5"))) return;
  await BANK(page);
  if (!(await clickNext(page, "шаг 5→6"))) return;
  if (!(await clickNext(page, "проверка→оплата"))) return;
  await payAndDocs(page);
});

// --- 2. Продажа автомобиля -------------------------------------------------
await run("Продажа автомобиля", async (page) => {
  await tiles(page, ["Продал автомобиль"]);
  if (!(await clickNext(page, "шаг 1→2"))) return;
  await fill(page, "Цена продажи", "600000");
  await fill(page, "Дата продажи", "2025-06-10");
  await fill(page, "Покупатель (ФИО)", "Петров Пётр Петрович");
  if (!(await clickNext(page, "продажа→о вас"))) return;
  await PERSONAL(page);
  if (!(await clickNext(page, "о вас→проверка"))) return;
  if (!(await clickNext(page, "проверка→оплата"))) return;
  await payAndDocs(page);
});

// --- 3. Смешанная: лечение + продажа квартиры ------------------------------
await run("Смешанная: лечение + продажа квартиры", async (page) => {
  await tiles(page, ["Платили за лечение", "Продал недвижимость"]);
  if (!(await clickNext(page, "шаг 1→2"))) return;
  await fill(page, "Цена продажи", "4000000");
  await fill(page, "Кадастровый номер", "74:36:0000000:1234");
  await fill(page, "Кадастровая стоимость", "3000000");
  await fill(page, "Дата продажи", "2025-06-10");
  await fill(page, "Дата приобретения", "2023-01-10");
  await fill(page, "Покупатель (ФИО)", "Петров Пётр Петрович");
  if (!(await clickNext(page, "продажа→доходы"))) return;
  await INCOME(page);
  if (!(await clickNext(page, "доходы→расходы"))) return;
  await fill(page, "Обычное лечение и лекарства", "60000");
  if (!(await clickNext(page, "расходы→о вас"))) return;
  await PERSONAL(page);
  if (!(await clickNext(page, "о вас→счёт"))) return;
  await BANK(page);
  if (!(await clickNext(page, "счёт→проверка"))) return;
  if (!(await clickNext(page, "проверка→оплата"))) return;
  await payAndDocs(page);
});

// --- 4. То же на телефоне ---------------------------------------------------
await run("Телефон 390px: лечение", async (page) => {
  await tiles(page, ["Платили за лечение"]);
  if (!(await clickNext(page, "шаг 1→2"))) return;
  await INCOME(page);
  if (!(await clickNext(page, "шаг 2→3"))) return;
  await fill(page, "Обычное лечение и лекарства", "60000");
  if (!(await clickNext(page, "шаг 3→4"))) return;
  await PERSONAL(page);
  if (!(await clickNext(page, "шаг 4→5"))) return;
  await BANK(page);
  if (!(await clickNext(page, "шаг 5→6"))) return;
  if (!(await clickNext(page, "проверка→оплата"))) return;
  await payAndDocs(page);
}, 390);

console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nВСЁ ЗЕЛЁНОЕ");
await browser.close();
process.exit(failures ? 1 : 0);
