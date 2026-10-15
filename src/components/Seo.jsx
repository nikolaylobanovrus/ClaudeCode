import { Helmet } from "react-helmet-async";
import { company } from "../data/content.js";

const BASE = company.site;

// Универсальный SEO-компонент: заголовок, описание, canonical,
// Open Graph и произвольные JSON-LD блоки (для Google, Яндекс и ИИ-поиска).
export default function Seo({
  title,
  description,
  path = "/",
  jsonLd = [],
  noindex = false,
  // canonical={false} — для страниц, у которых канонического адреса НЕТ.
  // Единственный такой случай — 404: её адреса не существует (тело отдаёт
  // nginx через error_page на любой путь), и объявлять каноническим «/404»
  // значит показывать поисковику ссылку на страницу, которая сама отдаёт 404.
  // Плюс canonical рядом с noindex — противоречивая пара сигналов.
  canonical = true,
}) {
  const url = BASE + path;
  const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={company.brand} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:image" content={`${BASE}/og-image.svg`} />
      <meta name="twitter:card" content="summary_large_image" />

      {blocks.map((b, i) => (
        <script type="application/ld+json" key={i}>
          {JSON.stringify(b)}
        </script>
      ))}
    </Helmet>
  );
}
