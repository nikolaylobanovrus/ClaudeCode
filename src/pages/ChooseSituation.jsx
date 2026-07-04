import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { getAccount, updateAccount, isLoggedIn } from "../lib/account.js";
import { situationArts } from "../components/SituationArt.jsx";
import { sbRpc } from "../lib/supabase.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";

const SITUATIONS = [
  { slug: "kvartira", label: "Купили квартиру или дом" },
  { slug: "ipoteka", label: "Платили за ипотеку" },
  { slug: "lechenie-obuchenie", label: "Платили за лечение или обучение" },
  { slug: "inostrannym", label: "3-НДФЛ для иностранных граждан" },
  { slug: "prodazha", label: "Продали недвижимость или автомобиль" },
  { slug: "inaya", label: "Иная ситуация" },
];

// Ситуации, у которых есть своя страница загрузки документов.
const DOC_SLUGS = ["ipoteka", "kvartira", "lechenie-obuchenie", "inostrannym", "prodazha"];

export default function ChooseSituation() {
  const navigate = useNavigate();
  const account = getAccount();
  const [selected, setSelected] = useState(account?.situation || "");

  // Страница доступна только после регистрации и входа.
  const logged = isLoggedIn();
  useEffect(() => {
    if (!account) navigate("/registraciya", { replace: true });
    else if (!logged) navigate("/vhod", { replace: true });
  }, [account, logged, navigate]);

  if (!account || !logged) return null;

  function choose(s) {
    setSelected(s.label);
    updateAccount({ situation: s.label });
    // Сообщаем менеджеру о выборе клиента (не блокируем интерфейс).
    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `Клиент выбрал ситуацию — ID ${account.id}`,
        _template: "table",
        _captcha: "false",
        "ID клиента": String(account.id),
        "Email": account.email,
        "Ситуация": s.label,
      }),
    }).catch(() => {
      /* дублирующее уведомление; выбор уже сохранён в кабинете */
    });
    // Обновляем ситуацию в базе клиентов (кабинет оператора).
    sbRpc("set_situation", { p_id: account.id, p_situation: s.label }).catch(
      () => {}
    );
    if (DOC_SLUGS.includes(s.slug)) navigate(`/situaciya/${s.slug}`);
  }

  return (
    <>
      <Seo
        title="Выберите ситуацию | Налог-сервис"
        description="Выберите свою ситуацию, и мы подготовим декларацию 3-НДФЛ."
        path="/vyberite-situaciyu"
        noindex
      />
      <PageHero
        eyebrow={`ID клиента: ${account.id}`}
        title="Выберите ситуацию"
        subtitle="За что вы хотите получить налоговый вычет? Выберите подходящую плашку — остальное мы возьмём на себя."
        crumbs={["Выберите ситуацию"]}
      />

      <section className="section">
        <div className="container">
          <div className="sit-grid">
            {SITUATIONS.map((s) => {
              const Art = situationArts[s.slug];
              const isSel = selected === s.label;
              return (
                <button
                  key={s.slug}
                  type="button"
                  className={"sit-card" + (isSel ? " is-selected" : "")}
                  onClick={() => choose(s)}
                  aria-pressed={isSel}
                >
                  <Art />
                  <span className="sit-card__label">
                    {s.label}
                    <span className="sit-card__mark" aria-hidden="true">
                      {isSel ? "✓" : "→"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="sit-done" role="status">
              <div className="form__success-icon">✓</div>
              <h3>Отличный выбор: «{selected}»</h3>
              <p>
                Мы получили вашу заявку. Специалист свяжется с вами, запросит
                документы и подготовит декларацию 3-НДФЛ.
              </p>
              <div className="cta__actions">
                {(() => {
                  const sel = SITUATIONS.find((s) => s.label === selected);
                  return sel && DOC_SLUGS.includes(sel.slug) ? (
                    <Link to={`/situaciya/${sel.slug}`} className="btn btn--green">
                      Загрузить документы
                    </Link>
                  ) : null;
                })()}
                <Link to="/kabinet" className="btn btn--primary">
                  Перейти в личный кабинет
                </Link>
                <Link to="/kontakty" className="btn btn--ghost">
                  Связаться с нами
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
