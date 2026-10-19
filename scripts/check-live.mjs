#!/usr/bin/env node
// Боевой сайт в браузере: проходит ли человек анкету до экрана оплаты.
//
//   node scripts/check-live.mjs            # налог-сервис.рф
//   SITE=https://… node scripts/check-live.mjs
//
// Зачем, когда есть check:wizard. Тот проверяет СБОРКУ на своём стенде, а
// это — то, что реально отдаёт сервер: nginx, порядок файлов, заголовки
// кеша, живые чанки. 19.10.2026 в воронке три дня подряд было «анкета
// открыта, дальше ноль», и вопрос «сломалась выкладка или люди просто
// уходят» решался только так.
//
// Наружу ничего не уходит: Метрика и mail.ru заблокированы (иначе проверка
// сама попадёт в статистику и исказит её), Supabase — тоже, поэтому заказ
// не создаётся и до реальной оплаты дело не доходит. Отдельно печатаем
// список целей, которые сайт ПЫТАЛСЯ отправить: если шаги идут, а целей нет,
// воронка в Метрике врёт — это разные поломки.
//
// Про сертификаты. Среда разработки перешифровывает HTTPS своим корневым
// сертификатом, которого нет в профиле браузера Playwright. Проверку
// сертификатов НЕ отключаем: вычисляем отпечатки ключей из бандла среды и
// доверяем ровно им (--ignore-certificate-errors-spki-list).
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SITE = process.env.SITE || "https://xn----7sbhcltqolxje.xn--p1ai";
const SHOTS = process.env.SHOT_DIR || "";
const CA = "/root/.ccr/ca-bundle.crt";

function caPins() {
  if (!existsSync(CA)) return "";
  const blocks = readFileSync(CA, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
  const pins = [];
  for (const pem of blocks) {
    try {
      const pub = execFileSync("openssl", ["x509", "-pubkey", "-noout"], { input: pem });
      const der = execFileSync("openssl", ["pkey", "-pubin", "-outform", "der"], { input: pub });
      pins.push(createHash("sha256").update(der).digest("base64"));
    } catch { /* сертификат не разобрался — пропускаем */ }
  }
  return pins.join(",");
}

if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const pins = caPins();
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: pins ? [`--ignore-certificate-errors-spki-list=${pins}`] : [],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

const goals = [];
await ctx.exposeFunction("__goal", (n, p) => goals.push(n + (p ? " " + JSON.stringify(p) : "")));
await ctx.addInitScript(() => {
  window.ym = (id, act, name, params) => { if (act === "reachGoal") window.__goal(name, params); };
});
await ctx.route(/mc\.yandex\.ru|top-fwz1\.mail\.ru/, (r) => r.abort());
await ctx.route(/\.supabase\.co/, (r) => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("JS: " + e.message.slice(0, 160)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(r.status() + " " + r.url().slice(0, 100)); });

let failures = 0;
const shot = (n) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${n}.png` }) : Promise.resolve());
const heading = async () => (await page.locator(".wiz__heading").first().innerText().catch(() => "")).trim();
const fill = async (label, value) => {
  const f = page.locator(".form__field", { hasText: label }).first();
  if (!(await f.count())) { failures++; console.log(`   ✗ поле «${label}» не найдено`); return; }
  await f.locator("input").first().fill(String(value));
};
const next = async (label) => {
  const before = await heading();
  await page.locator(".wiz__nav button.btn--primary").click();
  await page.waitForTimeout(1200);
  const after = await heading();
  if (before === after) {
    failures++;
    const msg = (await page.locator("p.form__error[role=alert]").allInnerTexts().catch(() => [])).join(" | ");
    const bad = (await page.locator(".form__field.has-error label").allInnerTexts().catch(() => [])).join(" · ");
    console.log(`   ✗ ${label}: застряли на «${before}» — ${msg || "сообщения нет"}${bad ? " | поля: " + bad : ""}`);
    return false;
  }
  console.log(`   ✓ ${label}: «${before}» → «${after}»`);
  return true;
};

const resp = await page.goto(SITE + "/deklaraciya/anketa", { waitUntil: "load", timeout: 45000 });
console.log(`анкета ${SITE}/deklaraciya/anketa — HTTP ${resp.status()}`);
await page.waitForSelector(".wiz__heading", { timeout: 30000 });
await shot("01-start");

await page.locator(".wiz__type", { hasText: "Платили за лечение" }).first().click();
await page.waitForTimeout(400);
if ((await page.locator(".wiz__type.is-active").count()) !== 1) { failures++; console.log("   ✗ ситуация не отметилась"); }

if (await next("Ситуация")) {
  await fill("Название организации", "ООО «Ромашка»");
  await fill("ИНН работодателя", "7420010847");
  await fill("КПП", "741501001");
  await fill("ОКТМО работодателя", "75701000");
  await fill("Общая сумма дохода", "1200000");
  await fill("Налог удержанный", "156000");
  if (await next("Доходы")) {
    await fill("Обычное лечение и лекарства", "60000");
    if (await next("Расходы")) {
      await fill("Фамилия", "Иванов"); await fill("Имя", "Пётр");
      await fill("ИНН", "500100732259"); await fill("Код инспекции (ИФНС)", "7447");
      await fill("ОКТМО", "75701000"); await fill("Телефон", "+79120000000");
      if (await next("О вас")) {
        await fill("БИК банка", "047501711");
        await fill("Номер счёта", "40702810007710002545");
        if (await next("Счёт")) {
          await shot("02-review");
          if (await next("Проверка")) {
            await page.waitForTimeout(1200);
            await shot("03-payment");
            const txt = await page.locator(".wiz__main").innerText();
            // 7 800 ₽ — это 13% от 60 000 ₽ лечения: сумма считается на бою,
            // а не берётся из воздуха.
            const sum = /7\s?800/.test(txt);
            const btn = await page.locator("button, a").filter({ hasText: /Оплатить/ }).count();
            if (!sum) { failures++; console.log("   ✗ на экране оплаты нет суммы возврата 7 800 ₽"); }
            if (!btn) { failures++; console.log("   ✗ нет кнопки оплаты"); }
            if (sum && btn) console.log("   ✓ экран оплаты: сумма возврата и кнопка на месте");
          }
        }
      }
    }
  }
}

const want = ["wizard_open", "situation", "wizard_step_income", "wizard_step_details",
              "wizard_step_personal", "wizard_step_bank", "wizard_step_review", "wizard_payment_step"];
const missing = want.filter((g) => !goals.some((x) => x.startsWith(g)));
if (missing.length) { failures++; console.log("   ✗ цели не отправлены: " + missing.join(", ")); }
else console.log(`   ✓ цели Метрики: все ${want.length} на месте`);

if (errors.length) console.log("\nошибки страницы:\n  " + errors.slice(0, 8).join("\n  "));
await browser.close();
console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nБоевая анкета проходится целиком, до экрана оплаты.");
process.exit(failures ? 1 : 0);
