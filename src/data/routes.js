// Единый список страниц сайта.
//
// Зачем отдельный файл, когда маршруты уже перечислены в App.jsx. Один и тот
// же список нужен в четырёх местах, и три из них — не React:
//
//   - пререндер (scripts/prerender.mjs) — что обходить браузером;
//   - sitemap.xml — что отдавать поисковику;
//   - check-no-hscroll.mjs — какие страницы проверять на вёрстку;
//   - check-routes.mjs — сверка с App.jsx, чтобы списки не разъехались.
//
// Пока список жил только в App.jsx, sitemap вели руками — и в нём осталась
// одна запись на весь сайт. Теперь наоборот: забыли дописать сюда новый
// маршрут — падает проверка, а не молча пустеет карта сайта.
//
// Файл СОЗНАТЕЛЬНО без JSX и без импортов из vite-окружения: его подключают
// node-скрипты напрямую, тем же приёмом, что и src/lib/ndfl/* в проверках.
//
// index — попадает ли страница в sitemap. Это ровно инверсия флага noindex,
// который каждая страница передаёт в <Seo>. Держать их согласованными —
// работа check-prerender.mjs: он читает готовый HTML и сверяет фактический
// мета-тег с этим полем.

export const ROUTES = [
  // --- Раздел самозаполнения (199 ₽) ---
  { path: "/", index: true, changefreq: "weekly", priority: "1.0" },
  { path: "/deklaraciya/instrukciya", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/kalkulyator-naloga-s-prodazhi", index: true, changefreq: "monthly", priority: "0.8" },
  // Лендинг под поисковый запрос, а не служебная страница раздела: priority
  // выше остальных внутренних, обновляться будет по мере изменений лимитов.
  { path: "/deklaraciya/vychet-za-kvartiru", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-za-ipoteku", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-za-lechenie", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-za-obuchenie", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/nalog-s-prodazhi-kvartiry", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/nalog-s-prodazhi-avtomobilya", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-na-detey", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/vychet-za-sport", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/vychet-po-iis", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/vychet-za-strahovanie-zhizni", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/vychet-po-pds", index: true, changefreq: "monthly", priority: "0.8" },
  // Перенос тем из Дзена. Уточнёнка — обычный лендинг под спрос, а разбор про
  // нерезидента НЕ продаёт: декларации для нерезидентов мы не делаем (код
  // статуса на титульном листе зашит резидентом, CODES.status), и страница
  // говорит это прямо. Приоритет у него ниже остальных именно поэтому.
  { path: "/deklaraciya/utochnennaya-deklaraciya", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/nalog-nerezidenta-s-prodazhi", index: true, changefreq: "monthly", priority: "0.7" },
  { path: "/deklaraciya/vychet-za-lechenie-zubov", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-suprugam", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/deklaraciya/vychet-pensioneram", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/vychet-za-tri-goda", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/deklaraciya/nalog-s-prodazhi-uchastka", index: true, changefreq: "monthly", priority: "0.9" },
  // Служебные страницы раздела: живой контент, но дублируют главную по смыслу.
  { path: "/deklaraciya/tarify", index: false },
  { path: "/deklaraciya/kontakty", index: false },
  // Анкета — за оплатой, индексировать нечего.
  { path: "/deklaraciya/anketa", index: false },
  { path: "/deklaraciya/oferta", index: false },

  // --- Раздел «под ключ» ---
  { path: "/pod-klyuch", index: true, changefreq: "monthly", priority: "0.9" },
  { path: "/vychety", index: true, changefreq: "monthly", priority: "0.8" },
  { path: "/tarify", index: true, changefreq: "monthly", priority: "0.7" },
  { path: "/kak-rabotaem", index: true, changefreq: "monthly", priority: "0.7" },
  { path: "/kontakty", index: true, changefreq: "monthly", priority: "0.6" },

  // --- Формы и личные разделы ---
  // /registraciya сейчас открыта индексации, хотя это форма. Менять набор
  // noindex в одной миграции с переходом на чистые URL не стоит: это другой
  // по смыслу шаг, и смешивать их — значит не понять, что подействовало.
  // Вернуться сюда отдельным коммитом (задача «пересмотр noindex»).
  { path: "/registraciya", index: true, changefreq: "yearly", priority: "0.3" },
  { path: "/vhod", index: false },
  { path: "/kabinet", index: false, gated: true },
  { path: "/operator", index: false },

  // --- Загрузка документов: за логином, неавторизованного уводит на
  // /registraciya (см. SituationDocsPage.jsx:90). Индексировать нельзя —
  // поисковик получит редирект, а не текст.
  //
  // gated: снимок делать нечего — браузер немедленно уходит на регистрацию, и
  // сохранился бы чужой экран под чужим адресом. Но файл всё равно нужен:
  // после этапа C nginx отдаёт 404 на всё, чего нет на диске, и вошедший
  // человек получил бы «страница не найдена» вместо своего кабинета. Поэтому
  // для таких страниц кладём обычную оболочку приложения — ровно то, что
  // отдавал SPA-фолбэк до перехода.
  { path: "/vyberite-situaciyu", index: false, gated: true },
  { path: "/situaciya/ipoteka", index: false, gated: true },
  { path: "/situaciya/kvartira", index: false, gated: true },
  { path: "/situaciya/lechenie-obuchenie", index: false, gated: true },
  { path: "/situaciya/inostrannym", index: false, gated: true },
  { path: "/situaciya/prodazha", index: false, gated: true },
  { path: "/situaciya/inaya", index: false, gated: true },

  // --- Юридические ---
  { path: "/politika-konfidencialnosti", index: false },
  { path: "/publichnaya-oferta", index: false },
];

// Старый адрес лендинга: на него ведут 88 из 109 объявлений Директа.
// В приложении это <Navigate to="/">, на сервере станет 301 (этап C).
// Пререндерить нечего — страницы как таковой нет.
export const REDIRECTS = [
  ["/deklaraciya", "/"],
  // Вход оператора: короткие и привычные адреса. Страницы как таковой нет —
  // роутер уводит на /operator, но ФАЙЛ на диске нужен, иначе nginx отдаст
  // честный 404 (этап C) ещё до того, как приложение успеет загрузиться.
  ["/deklaraciya/operator", "/operator"],
  ["/mama", "/operator"],
];

// --- Картинка превью ссылок (og:image) --------------------------------------
//
// На сайте два разных предложения, и до 16.10.2026 обе половины показывали
// одну карточку — «Налоговый вычет под ключ». То есть человек, пересылающий
// ссылку на анкету за 199 ₽, рекламировал другую услугу.
//
// Поэтому картинок две, и выбирает их ПУТЬ, а не каждая страница сама:
// страниц много, передавать параметр в каждый <Seo> — значит однажды забыть.
// Тот же выбор делает проверка (check-prerender), читая готовый HTML.
//
// Размеры обязаны совпадать с файлами public/og-*.png; перерисовать:
// node scripts/build-og-image.mjs
//
// Адрес картинки — АБСОЛЮТНЫЙ и в punycode, а не «https://налог-сервис.рф/…».
// Домен кириллический, и браузер приводит его к ASCII сам, а вот сторонний
// HTTP-клиент — не обязательно: в этой же среде curl с кириллическим адресом
// не достучался до сайта, хотя punycode-адрес открыл. Краулеры мессенджеров
// проверить отсюда нельзя, но ставить картинку в зависимость от их обработки
// IDN незачем — punycode понимают все, а человеку этот адрес не виден.
const ASCII = "https://xn----7sbhcltqolxje.xn--p1ai";

const OG_SAM = {
  src: ASCII + "/og-sam.jpg",
  file: "og-sam.jpg",
  type: "image/jpeg",
  width: 1200,
  height: 630,
  alt: "Налог-сервис: декларация 3-НДФЛ за 15 минут, 199 ₽",
};
const OG_POD_KLYUCH = {
  src: ASCII + "/og-pod-klyuch.jpg",
  file: "og-pod-klyuch.jpg",
  type: "image/jpeg",
  width: 1200,
  height: 630,
  alt: "Налог-сервис: налоговый вычет под ключ",
};

// Страницы услуги «под ключ». Всё остальное — самозаполнение: главная и
// весь /deklaraciya, а также юридические страницы, общие для обеих половин
// (их почти не пересылают, а главная у сайта одна — самозаполнение).
const POD_KLYUCH = [
  "/pod-klyuch",
  "/vychety",
  "/tarify",
  "/kak-rabotaem",
  "/kontakty",
  "/registraciya",
  "/vhod",
  "/kabinet",
  "/vyberite-situaciyu",
  "/situaciya",
];

export const ogImageFor = (path = "/") =>
  POD_KLYUCH.some((p) => path === p || path.startsWith(p + "/"))
    ? OG_POD_KLYUCH
    : OG_SAM;

export const indexableRoutes = () => ROUTES.filter((r) => r.index);

// Путь → файл в dist. Корень живёт в самом dist/index.html, остальные — в
// подкаталогах, чтобы nginx отдавал их как $uri/index.html.
export const routeFile = (path) =>
  path === "/" ? "index.html" : path.replace(/^\//, "") + "/index.html";
