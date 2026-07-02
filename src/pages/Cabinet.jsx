import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PageHero from "../components/PageHero.jsx";
import { getAccount, isLoggedIn, setLoggedIn } from "../lib/account.js";
import { company } from "../data/content.js";

export default function Cabinet() {
  const navigate = useNavigate();
  const account = getAccount();

  const logged = isLoggedIn();

  useEffect(() => {
    if (!account) navigate("/registraciya", { replace: true });
    else if (!logged) navigate("/vhod", { replace: true });
  }, [account, logged, navigate]);

  if (!account || !logged) return null;

  const created = new Date(account.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function logout() {
    // Завершаем сессию, но кабинет сохраняем — вход по почте/ID и паролю.
    setLoggedIn(false);
    navigate("/vhod");
  }

  return (
    <>
      <Seo
        title="Личный кабинет | Налог-сервис"
        description="Личный кабинет клиента Налог-сервис."
        path="/kabinet"
        noindex
      />
      <PageHero
        eyebrow="Личный кабинет"
        title={`Клиент №${account.id}`}
        subtitle="Здесь хранятся ваши данные и выбранная ситуация."
        crumbs={["Личный кабинет"]}
      />

      <section className="section">
        <div className="container">
          <div className="auth">
            <dl className="cabinet__list">
              <div>
                <dt>ID клиента</dt>
                <dd>{account.id}</dd>
              </div>
              <div>
                <dt>E-mail (логин)</dt>
                <dd>{account.email}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>{account.phone || "не указан"}</dd>
              </div>
              <div>
                <dt>Дата регистрации</dt>
                <dd>{created}</dd>
              </div>
              <div>
                <dt>Выбранная ситуация</dt>
                <dd>
                  {account.situation || (
                    <Link to="/vyberite-situaciyu" style={{ color: "var(--blue-600)", fontWeight: 700 }}>
                      Выбрать ситуацию →
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  {account.docsStatus === "sent"
                    ? "Документы получены — готовим декларацию 3-НДФЛ"
                    : account.docsStatus === "draft"
                      ? "Сохранён черновик — завершите загрузку документов"
                      : account.situation
                        ? "Заявка принята — специалист свяжется с вами"
                        : "Ожидает выбора ситуации"}
                </dd>
              </div>
            </dl>

            <p style={{ color: "var(--ink-500)", fontSize: 14, margin: "18px 0" }}>
              Вопросы? Звоните{" "}
              <a href={`tel:${company.phoneRaw}`} style={{ color: "var(--blue-700)", fontWeight: 700 }}>
                {company.phone}
              </a>{" "}
              (колл-центр 24/7) или пишите на{" "}
              <a href={`mailto:${company.email}`} style={{ color: "var(--blue-700)", fontWeight: 700 }}>
                {company.email.toLowerCase()}
              </a>
              .
            </p>

            <div className="cta__actions" style={{ justifyContent: "flex-start" }}>
              {account.situation === "Платили за ипотеку" &&
                account.docsStatus !== "sent" && (
                  <Link to="/situaciya/ipoteka" className="btn btn--green">
                    {account.docsStatus === "draft"
                      ? "Продолжить загрузку документов"
                      : "Загрузить документы"}
                  </Link>
                )}
              <Link to="/vyberite-situaciyu" className="btn btn--primary">
                {account.situation ? "Изменить ситуацию" : "Выбрать ситуацию"}
              </Link>
              <button className="btn btn--ghost" onClick={logout}>
                Выйти из кабинета
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
