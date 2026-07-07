// Тарифы «сделаем за вас» ВНУТРИ раздела «Заполнить самому» (/deklaraciya/tarify).
// Своя, самодостаточная страница: клиент, пришедший по рекламе на лендинг
// авто-вычета, не «проваливается» в основной сайт через общую страницу
// тарифов. Навигация ведёт обратно к заполнению самому, а заявку он оставляет
// прямо здесь (та же LeadForm, что и на основном сайте).
import { useRef } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { tariffs, selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";

export default function SelfServiceTariffs() {
  const formRef = useRef(null);
  const toForm = () =>
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <Seo
        title="Сделаем декларацию 3-НДФЛ за вас — тарифы | Налог-сервис"
        description="Не хотите заполнять сами? Специалист подготовит декларацию 3-НДФЛ по вашим документам. Тарифы «Базовый», «Оптимальный» и «Премиум» — оплата по факту готовности."
        path="/deklaraciya/tarify"
        noindex
      />

      {/* Свой герой: крошка ведёт назад к заполнению самому, а не в основной
          сайт — клиент остаётся в разделе авто-вычета. */}
      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/deklaraciya">Заполнить самому</Link>
            <span>/ Сделаем за вас</span>
          </nav>
          <span className="eyebrow hero__eyebrow">Сделаем за вас</span>
          <h1 className="page-hero__title">
            Не хотите разбираться сами? Сделаем декларацию за вас
          </h1>
          <p className="page-hero__subtitle">
            Специалист подготовит декларацию 3-НДФЛ по вашим документам, проверит
            каждую цифру и подскажет, как подать. Оплата — только по факту
            готовности документов.
          </p>
          <div className="hero__actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn--green btn--lg" onClick={toForm}>
              Оставить заявку
            </button>
            <Link to="/deklaraciya/anketa" className="btn btn--light btn--lg">
              Или заполнить самому — {fmtRub(selfService.price)}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="tariffs">
            {/* Самый доступный вариант — заполнить самому за 99 ₽. Показываем
                первым, чтобы у клиента перед глазами были все тарифы. */}
            <div className="tariff">
              <div className="tariff__name">Сам онлайн</div>
              <div className="tariff__caption">Заполняете анкету сами — документы сразу</div>
              <div className="tariff__price">
                {fmtRub(selfService.price)}{" "}
                {/* У этого тарифа старой цены нет — скрытый плейсхолдер
                    резервирует ту же строку, что и у платных карточек, чтобы
                    «Срок» и списки стояли в одну линию. */}
                <span className="tariff__old" aria-hidden="true" style={{ visibility: "hidden" }}>
                  0 ₽
                </span>
              </div>
              <div className="tariff__term">Срок — 15 минут</div>
              <ul className="tariff__features">
                {[
                  "Декларация 3-НДФЛ (PDF)",
                  "Файл для Личного кабинета ФНС",
                  "Заявление на возврат налога",
                  "Подсказки к каждому полю",
                ].map((f) => (
                  <li key={f}>
                    <span className="tariff__check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/deklaraciya/anketa" className="btn btn--block btn--ghost">
                Заполнить самому
              </Link>
            </div>
            {tariffs.map((t) => (
              <div
                className={"tariff" + (t.highlight ? " tariff--hot" : "")}
                key={t.name}
              >
                {t.highlight && <div className="tariff__badge">Хит продаж</div>}
                <div className="tariff__name">{t.name}</div>
                <div className="tariff__caption">{t.caption}</div>
                <div className="tariff__price">
                  {t.price}{" "}
                  {t.oldPrice && <span className="tariff__old">{t.oldPrice}</span>}
                </div>
                <div className="tariff__term">Срок — {t.term}</div>
                <ul className="tariff__features">
                  {t.features.map((f) => (
                    <li key={f}>
                      <span className="tariff__check">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={toForm}
                  className={
                    "btn btn--block " + (t.highlight ? "btn--primary" : "btn--ghost")
                  }
                >
                  Заказать
                </button>
                {/* Вторичный путь: клиент, который уже готов, регистрируется
                    и сам загружает документы в личный кабинет. */}
                <span className="tariff__alt">
                  или <Link to="/registraciya">загрузить документы самому</Link>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Заявка прямо здесь — клиент не уходит с раздела авто-вычета. */}
      <section className="section section--soft">
        <div className="container">
          <div className="section__head">
            <span className="eyebrow">Как заказать</span>
            <h2 className="section__title">Два способа доверить нам декларацию</h2>
            <p className="section__subtitle">
              Оставьте заявку — и мы всё уточним, — или сразу загрузите
              документы в личный кабинет, если готовы.
            </p>
          </div>

          {/* Две дорожки: перезвоним ИЛИ клиент сам загружает документы. */}
          <div className="order-ways">
            <div className="order-way">
              <div className="order-way__icon" aria-hidden="true">📞</div>
              <div className="order-way__title">Оставьте заявку</div>
              <p className="order-way__text">
                Перезвоним, уточним вашу ситуацию, подберём тариф и подскажем,
                какие документы нужны. Консультация бесплатна.
              </p>
              <button type="button" className="btn btn--green btn--block" onClick={toForm}>
                Оставить заявку
              </button>
            </div>
            <div className="order-way">
              <div className="order-way__icon" aria-hidden="true">📎</div>
              <div className="order-way__title">Уже готовы? Загрузите документы</div>
              <p className="order-way__text">
                Зарегистрируйтесь в личном кабинете и приложите справки и
                договоры — специалист сразу возьмёт вашу декларацию в работу.
              </p>
              <Link to="/registraciya" className="btn btn--primary btn--block">
                Загрузить документы
              </Link>
            </div>
          </div>

          <div className="auth" ref={formRef}>
            <LeadForm title="Заявка на подготовку декларации" />
          </div>
        </div>
      </section>

      {/* Обратный путь к заполнению самому — на случай, если передумали. */}
      <section className="cta">
        <div className="cta__inner container">
          <h2 className="cta__title">Готовы заполнить сами за {fmtRub(selfService.price)}?</h2>
          <p className="cta__text">
            Анкета с подсказками к каждому полю занимает 15 минут, документы
            открываются сразу после оплаты.
          </p>
          <div className="cta__actions">
            <Link to="/deklaraciya/anketa" className="btn btn--green btn--lg">
              Заполнить самому
            </Link>
            <Link to="/deklaraciya" className="btn btn--light btn--lg">
              ← Вернуться на страницу услуги
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
