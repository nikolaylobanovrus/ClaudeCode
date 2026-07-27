// Пиксель VK Рекламы (счётчик Top.Mail.Ru): безопасные обёртки по образцу
// метрики. Пока ID пустой — модуль полностью выключен: скрипт не грузится,
// все вызовы no-op. Чтобы включить, достаточно вписать ID пикселя из
// кабинета VK Рекламы (ads.vk.com → Пиксели) и пересобрать сайт.
const ID = "";

// Подключение счётчика: официальный сниппет, вставленный динамически —
// без ID нет ни запроса к top-fwz1.mail.ru, ни мусора в window.
export function initVkPixel() {
  if (!ID) return;
  try {
    const tmr = (window._tmr = window._tmr || []);
    tmr.push({ id: ID, type: "pageView", start: Date.now() });
    if (document.getElementById("tmr-code")) return;
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.id = "tmr-code";
    s.src = "https://top-fwz1.mail.ru/js/code.js";
    document.head.appendChild(s);
  } catch {
    /* ignore */
  }
}

// Просмотр страницы в SPA — вызывается на смену роута (кроме первой:
// её отправляет initVkPixel).
export function vkHit() {
  if (!ID) return;
  try {
    window._tmr?.push({ id: ID, type: "pageView", start: Date.now() });
  } catch {
    /* ignore */
  }
}

// Цель (для аудиторий ретаргетинга и конверсий). Имена целей совпадают
// с целями Метрики — их же нужно завести в кабинете VK Рекламы.
export function vkGoal(name, value) {
  if (!ID) return;
  try {
    const ev = { type: "reachGoal", id: ID, goal: name };
    if (Number(value) > 0) ev.value = Number(value);
    window._tmr?.push(ev);
  } catch {
    /* ignore */
  }
}
