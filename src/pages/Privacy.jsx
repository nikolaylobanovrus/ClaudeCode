import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { privacyPolicy } from "../data/legal.js";

export default function Privacy() {
  return (
    <>
      <Seo
        title="Политика конфиденциальности | Налог-сервис"
        description="Политика ООО «Информкарт» в отношении обработки персональных данных: цели, принципы, права субъектов персональных данных и меры по обеспечению безопасности."
        path="/politika-konfidencialnosti"
        noindex
      />
      <PageHero
        title="Политика конфиденциальности"
        subtitle={privacyPolicy.title}
        crumbs={["Политика конфиденциальности"]}
      />

      <section className="section">
        <div className="container prose">
          <div className="legal-approve">
            {privacyPolicy.approved.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          {privacyPolicy.sections.map((s) => (
            <div key={s.h}>
              <h2>{s.h}</h2>
              {s.p && s.p.map((p, i) => <p key={i}>{p}</p>)}
              {s.li && (
                <ul className="dashed">
                  {s.li.map((li, i) => (
                    <li key={i}>{li}</li>
                  ))}
                </ul>
              )}
              {s.pAfter && s.pAfter.map((p, i) => <p key={`a${i}`}>{p}</p>)}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
