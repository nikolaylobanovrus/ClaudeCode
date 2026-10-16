// Общий каркас лендингов под поисковые запросы («вычет за квартиру», «вычет
// за ипотеку», «вычет за лечение» и следующие).
//
// Зачем компонент, а не копия вёрстки на каждой странице. Страницы у нас
// отличаются ТЕКСТОМ, а не устройством: шапка с суммой и кнопкой, карточки
// разбора, частые вопросы, финальный призыв. Скопировав разметку трижды, мы
// получили бы три места, где надо не забыть поправить кнопку, хлебные крошки
// или разметку FAQ. Здесь это одно место, а страницы остаются содержанием.
//
// Что обязан дать каждый лендинг (props):
//   path       — адрес страницы, он же canonical и ссылка в хлебных крошках;
//   crumb      — короткое название в хлебных крошках;
//   h1, lead   — заголовок и первый абзац (lead — JSX, в нём есть <strong>);
//   preselect  — слаг ситуации для анкеты: кнопка ведёт на
//                /deklaraciya/anketa?s=<slug>, и человеку на шаг меньше;
//   ctaHref, ctaLabel, ctaLabelBottom, note — для страниц без «своей» ситуации
//                в анкете (уточнёнка, нерезидент): куда ведёт кнопка и что
//                написано под ней;
//   seoTitle, seoDescription — то, что увидит человек в выдаче;
//   howTo      — шаги для разметки HowTo (schema.org), можно не передавать;
//   faq        — [{q, a}], идёт и в видимый блок, и в разметку FAQPage;
//   children   — карточки разбора.
import { Link } from "react-router-dom";
import Seo from "./Seo.jsx";
import Faq from "./Faq.jsx";
import { company } from "../data/content.js";

export default function DeductionLanding({
  path,
  crumb,
  h1,
  lead,
  // Слаг ситуации для анкеты: кнопка ведёт на /deklaraciya/anketa?s=<slug>.
  // Нужен не всем: у страниц про уточнёнку и про нерезидента своей «ситуации»
  // в анкете нет — там кнопка ведёт просто в анкету или на калькулятор
  // (ctaHref), а обещать несуществующий предвыбор нельзя.
  preselect = null,
  ctaHref = null,
  ctaLabel = "Рассчитать мой вычет",
  ctaLabelBottom = "Начать заполнение",
  // Строка под кнопкой. По умолчанию — обещание «сумма видна до оплаты», но
  // оно верно не для всякой страницы: на разборе про нерезидента кнопка ведёт
  // в калькулятор, который считает по ставке резидента, и обещать там «вашу
  // сумму» нельзя.
  note = "Бесплатно и без регистрации: сумма к возврату видна до оплаты.",
  seoTitle,
  seoDescription,
  howTo = null,
  faq = [],
  // Заголовок блока вопросов — с темой страницы: «Частые вопросы про вычет
  // за квартиру» и в выдаче читается лучше, и человеку понятнее, про что
  // именно спрашивают.
  faqTitle = "Частые вопросы",
  ctaTitle,
  ctaText,
  children,
}) {
  // Куда ведут обе кнопки страницы.
  const href = ctaHref || (preselect ? `/deklaraciya/anketa?s=${preselect}` : "/deklaraciya/anketa");

  const jsonLd = [
    faq.length && {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    howTo && {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: howTo.name,
      step: howTo.steps.map((s) => ({
        "@type": "HowToStep",
        name: s.name,
        text: s.text,
      })),
    },
  ].filter(Boolean);

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={path}
        jsonLd={jsonLd}
      />

      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Заполнить самому</Link>
            <span>/ {crumb}</span>
          </nav>
          <h1 className="page-hero__title">{h1}</h1>
          <p className="page-hero__subtitle">{lead}</p>
          {/* Мягкий вход вместо «купите декларацию»: человек пришёл из поиска
              с вопросом «сколько мне вернут», и первой кнопкой логично
              отвечать именно на него. Анкета считает сумму по ходу и
              показывает её ДО оплаты — платят только за готовые документы,
              так что обещание кнопки выполняется буквально. */}
          <div className="hero__actions">
            <Link to={href} className="btn btn--green btn--lg">
              {ctaLabel}
            </Link>
          </div>
          <p className="page-hero__note">{note}</p>
        </div>
      </section>

      <section className="section">
        <div className="container instr">{children}</div>
      </section>

      {faq.length > 0 && (
        <section className="section section--muted">
          <div className="container">
            <div className="section__head">
              <span className="eyebrow">Вопросы</span>
              <h2 className="section__title">{faqTitle}</h2>
            </div>
            <Faq items={faq} />
          </div>
        </section>
      )}

      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">{ctaTitle}</h2>
          <p className="cta__text">{ctaText}</p>
          <div className="cta__actions">
            <Link to={href} className="btn btn--green btn--lg">
              {ctaLabelBottom}
            </Link>
            <a href={company.telegram} className="btn btn--light btn--lg">
              Спросить в Telegram
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

// Блок-карточка разбора: заголовок второго уровня и содержимое.
export function LandingBlock({ title, children }) {
  return (
    <article className="card instr__block">
      <h2>{title}</h2>
      {children}
    </article>
  );
}
