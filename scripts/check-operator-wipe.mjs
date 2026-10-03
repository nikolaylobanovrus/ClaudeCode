#!/usr/bin/env node
// Кнопка оператора «Очистить анкету»: видна тому, кому надо, и стирает всё.
//
//   npm run check:wipe
//
// Зачем именно браузером. Проверка в Node (check-purchase.mjs) ловит главную
// тонкость — что из localStorage ничего не возвращается. Но она не видит
// двух вещей, от которых зависит вся польза кнопки:
//
//   1. кнопка показана ОПЕРАТОРУ и скрыта от клиента. Покажись она клиенту —
//      он сотрёт собственную оплаченную анкету одним кликом;
//   2. после нажатия в полях формы не осталось данных прошлого клиента.
//      Ради этого кнопка и делалась: чужие ФИО и паспорт в декларации — это
//      не «неудобно», это документ не того человека.
import { serveDist, launchChromium, blockExternals } from "./_serve-dist.mjs";

const DRAFT_KEY = "ns.decl.draft.v1";
const OP_SESSION_KEY = "ns.op.session";
const ANKETA = "/deklaraciya/anketa";

// Анкета «предыдущего клиента»: то, что оператор обязан стереть.
const PREV = {
  v: 2, step: 0, year: 2024, types: ["lechenie"],
  personal: {
    lastName: "Предыдущий", firstName: "Клиент", middleName: "Сергеевич",
    inn: "500100732259", birthDate: "1985-04-12", birthPlace: "г. Челябинск",
    passportSeries: "7512", passportNumber: "123456", passportDate: "2012-05-20",
    passportIssuer: "ОУФМС", phone: "+79120000000", oktmo: "75701000", ifns: "7447",
  },
  incomes: [{ name: "ООО «Прошлое»", inn: "7420010847", kpp: "741501001",
              oktmo: "75701000", income: "1200000", withheld: "156000" }],
  medical: { ordinary: "60000", expensive: "" },
  bank: { bik: "047501711", account: "40702810007710002545" },
  purchases: [{ id: "paid-prev-1", draftHash: "zzz", snapshot: {} }],
  order: { id: "order-waiting-prev", status: "waiting" },
};

const { base, close } = await serveDist({ fallback: "index" });
const browser = await launchChromium();
let failures = 0;
const say = (label, ok, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !extra ? "" : `\n      ${extra}`}`);
};

// Контекст с подсаженным черновиком и, по желанию, сессией оператора.
async function open({ operator }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await blockExternals(ctx);
  await ctx.addInitScript(
    ([k, draft, opKey, session]) => {
      try {
        localStorage.setItem(k, draft);
        if (session) localStorage.setItem(opKey, session);
        else localStorage.removeItem(opKey);
      } catch { /* приватный режим — проверка всё равно осмысленна */ }
    },
    [
      DRAFT_KEY,
      JSON.stringify({ ...PREV, savedAt: new Date().toISOString() }),
      OP_SESSION_KEY,
      operator
        ? JSON.stringify({
            access_token: "test-token",
            refresh_token: "test-refresh",
            // Срок в будущем: истёкшая сессия оператором не считается.
            expires_at: Date.now() + 3600_000,
          })
        : null,
    ]
  );
  const page = await ctx.newPage();
  await page.goto(base + ANKETA, { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector(".site__main", { timeout: 20000 });
  return { ctx, page };
}

const BTN = 'button:has-text("Очистить анкету полностью")';

console.log("=== кнопку видит только оператор ===");
{
  const { ctx, page } = await open({ operator: false });
  say("клиенту кнопка не показана", (await page.locator(BTN).count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({ operator: true });
  say("оператору кнопка показана", (await page.locator(BTN).count()) === 1);
  await ctx.close();
}

console.log("\n=== после нажатия не остаётся ничего ===");
{
  const { ctx, page } = await open({ operator: true });

  // Отказ в подтверждении не должен стирать ничего: кнопка рядом с рабочими
  // полями, промахнуться по ней легко.
  page.once("dialog", (d) => d.dismiss());
  await page.locator(BTN).click();
  await page.waitForTimeout(300);
  const kept = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
  say("отказ в подтверждении ничего не стирает", Boolean(kept) && kept.includes("Предыдущий"));

  page.once("dialog", (d) => d.accept());
  await page.locator(BTN).click();
  await page.waitForTimeout(600);

  // 1. В хранилище не осталось данных прошлого клиента. Черновик может быть
  //    перезаписан пустым — это нормально; важно, чего в нём НЕТ.
  const raw = (await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)) || "";
  const traces = ["Предыдущий", "500100732259", "7512", "40702810007710002545",
                  "paid-prev-1", "order-waiting-prev", "1200000"];
  const left = traces.filter((t) => raw.includes(t));
  say("в хранилище не осталось следов прошлого клиента", left.length === 0,
      `нашлось: ${left.join(", ")}`);

  // 2. И на экране тоже. Считаем ИМЕННО плитки ситуаций (.wiz__type):
  //    более широкий селектор ловил бы ещё и чип «Первичная», который после
  //    сброса активен по праву — номер корректировки 0 и есть первичная.
  const state = await page.evaluate(() => ({
    checked: document.querySelectorAll(".wiz__type.is-active").length,
    year: document.querySelector(".calc__chip.is-active")?.innerText.trim() || "",
    text: document.querySelector(".site__main")?.innerText || "",
  }));
  say("на экране не осталось выбранных ситуаций", state.checked === 0);
  say("год сброшен на свежий (был 2024)", state.year !== "2024", `показан ${state.year}`);
  say("на экране не видно данных прошлого клиента", !state.text.includes("Предыдущий"));

  await ctx.close();
}

await browser.close();
await close();
console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nКнопка очистки работает и видна только оператору.");
process.exit(failures ? 1 : 0);
