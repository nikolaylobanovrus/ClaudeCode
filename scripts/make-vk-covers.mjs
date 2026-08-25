// Обложки для VK Рекламы в стиле обложек Авито (docs/avito/img): тёмно-синий
// градиент, белый заголовок, зелёная «пилюля» с суммой, марка сверху.
//
// Запуск: node scripts/make-vk-covers.mjs
// Кладёт PNG в docs/vk/img: по два размера на каждый сюжет — 1080×1350 (4:5,
// основной формат ленты) и 600×600 (1:1). Требования к размерам — из справки
// VK Рекламы для универсального объявления.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const OUT = new URL("../docs/vk/img/", import.meta.url).pathname;

const CARDS = [
  { slug: "kvartira", title: "Налоговый вычет за покупку жилья", pill: "вернём до 260 000 ₽" },
  { slug: "ipoteka", title: "Вычет за проценты по ипотеке", pill: "вернём до 390 000 ₽" },
  { slug: "lechenie", title: "Вычет за лечение и зубы", pill: "вернём до 19 500 ₽ в год" },
  { slug: "obuchenie", title: "Вычет за обучение — своё и детей", pill: "вернём до 33 800 ₽" },
  { slug: "prodazha", title: "Продали квартиру или машину?", pill: "посчитаем налог бесплатно" },
  { slug: "sam", title: "3-НДФЛ сами, за 15 минут", pill: "199 ₽ вместо 3 000 ₽" },
];

const FOOT = "Готовые PDF и XML для личного кабинета ФНС";

const html = ({ title, pill, w, h }) => `
<!doctype html><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=PT+Sans:wght@700&family=Golos+Text:wght@400;600&display=swap');
  * { margin: 0; box-sizing: border-box; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; }
  .card {
    position: relative; width: ${w}px; height: ${h}px; overflow: hidden;
    background: linear-gradient(160deg, #0b2a6b 0%, #1447c4 100%);
    color: #fff; font-family: "Golos Text", system-ui, sans-serif;
    padding: ${Math.round(w * 0.075)}px; display: flex; flex-direction: column;
  }
  /* Круг-акцент, как на обложках Авито. */
  .blob {
    position: absolute; right: ${-w * 0.16}px; top: ${-h * 0.12}px;
    width: ${w * 0.62}px; height: ${w * 0.62}px; border-radius: 50%;
    background: #2563eb; opacity: .85;
  }
  .brand {
    position: relative; font-family: "PT Sans", sans-serif; font-weight: 700;
    font-size: ${Math.round(w * 0.052)}px; letter-spacing: -.01em;
  }
  .brand::after {
    content: ""; display: block; width: ${Math.round(w * 0.2)}px;
    height: ${Math.max(3, Math.round(w * 0.007))}px; margin-top: ${Math.round(w * 0.012)}px;
    background: #34d399; border-radius: 2px;
  }
  h1 {
    position: relative; margin-top: auto; font-family: "PT Sans", sans-serif;
    font-weight: 700; font-size: ${Math.round(w * 0.093)}px; line-height: 1.08;
    letter-spacing: -.02em; text-wrap: balance;
  }
  .pill {
    position: relative; align-self: flex-start; margin-top: ${Math.round(h * 0.045)}px;
    background: #16a34a; border-radius: 999px;
    padding: ${Math.round(w * 0.035)}px ${Math.round(w * 0.06)}px;
    font-family: "PT Sans", sans-serif; font-weight: 700;
    font-size: ${Math.round(w * 0.058)}px; line-height: 1.1;
  }
  .foot {
    position: relative; margin-top: auto; padding-top: ${Math.round(h * 0.04)}px;
    font-size: ${Math.round(w * 0.033)}px; color: #cbd9ff;
  }
</style>
<div class="card">
  <div class="blob"></div>
  <div class="brand">Налог-сервис</div>
  <h1>${title}</h1>
  <div class="pill">${pill}</div>
  <div class="foot">${FOOT}</div>
</div>`;

const SIZES = [
  { name: "45", w: 1080, h: 1350 },
  { name: "11", w: 600, h: 600 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const card of CARDS) {
  for (const s of SIZES) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.setContent(html({ ...card, w: s.w, h: s.h }), { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}vk-${card.slug}-${s.name}.png` });
    await page.close();
    console.log(`vk-${card.slug}-${s.name}.png  ${s.w}×${s.h}`);
  }
}
await browser.close();
