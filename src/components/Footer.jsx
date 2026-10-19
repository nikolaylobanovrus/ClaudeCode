import { Link, useLocation, useNavigate } from "react-router-dom";
import { company } from "../data/content.js";
import Logo from "./Logo.jsx";

// Разделы подвала — свои для основного сайта и для авто-вычета (как в шапке):
// внутри /deklaraciya/* ссылки ведут по разделу, а не в основной сайт.
const MAIN_SECTIONS = [
  { to: "/vychety", label: "Виды вычетов" },
  { to: "/kak-rabotaem", label: "Как работаем" },
  { to: "/tarify", label: "Тарифы" },
  { to: "/kontakty", label: "Контакты" },
];
// Подвал раздела самозаполнения: служебные ссылки отдельно, разборы
// отдельно. Пока список был один, в «Разделах» подряд висели 29 пунктов —
// владелец справедливо сказал, что это некрасиво (19.10.2026). Разборы
// переехали в свою колонку «Полезные статьи», она верстается в несколько
// газетных колонок и потому занимает немного места.
//
// Ссылки из подвала — не косметика: подвал есть на каждой странице, и это
// самый дешёвый способ дать входящие ссылки всем 29 разборам. Проверка
// check-links требует, чтобы у каждой индексируемой страницы была хотя бы
// одна входящая, так что выкидывать их отсюда нельзя — только
// перекладывать.
const SELF_SECTIONS = [
  { to: "/", scrollTo: "sd-vychety", label: "Виды вычетов" },
  { to: "/", scrollTo: "sd-kak-rabotaem", label: "Как работаем" },
  { to: "/deklaraciya/instrukciya", label: "Как подать декларацию" },
  { to: "/deklaraciya/kalkulyator-naloga-s-prodazhi", label: "Калькулятор налога" },
  { to: "/deklaraciya/tarify", label: "Тарифы" },
  { to: "/deklaraciya/kontakty", label: "Контакты" },
];

// Разборы по ситуациям и статьи-ответы. Порядок — от самого частого спроса
// к редкому, внутри тем: покупка жилья, лечение, обучение, прочие вычеты,
// продажа, и в конце — вопросы вокруг декларации.
const SELF_ARTICLES = [
  { to: "/deklaraciya/vychet-za-kvartiru", label: "Вычет за квартиру" },
  { to: "/deklaraciya/vychet-za-ipoteku", label: "Вычет по ипотеке" },
  { to: "/deklaraciya/vychet-za-novostroyku", label: "Вычет за новостройку" },
  { to: "/deklaraciya/vychet-suprugam", label: "Вычет супругам" },
  { to: "/deklaraciya/ostatok-imushchestvennogo-vycheta", label: "Остаток вычета" },
  { to: "/deklaraciya/vychet-pensioneram", label: "Вычет пенсионерам" },
  { to: "/deklaraciya/vychet-za-lechenie", label: "Вычет за лечение" },
  { to: "/deklaraciya/vychet-za-lechenie-zubov", label: "Лечение зубов" },
  { to: "/deklaraciya/dorogostoyashchee-lechenie", label: "Дорогостоящее лечение" },
  { to: "/deklaraciya/vychet-za-lechenie-blizkih", label: "Лечение родных" },
  { to: "/deklaraciya/vychet-za-obuchenie", label: "Вычет за обучение" },
  { to: "/deklaraciya/vychet-za-obuchenie-rebenka", label: "Обучение ребёнка" },
  { to: "/deklaraciya/vychet-na-detey", label: "Вычет на детей" },
  { to: "/deklaraciya/vychet-za-sport", label: "Вычет за спорт" },
  { to: "/deklaraciya/vychet-po-iis", label: "Вычет по ИИС" },
  { to: "/deklaraciya/vychet-za-strahovanie-zhizni", label: "Страхование жизни" },
  { to: "/deklaraciya/vychet-po-pds", label: "Вычет по ПДС" },
  { to: "/deklaraciya/vychet-za-tri-goda", label: "Вычет за три года" },
  { to: "/deklaraciya/vychet-cherez-rabotodatelya", label: "Вычет у работодателя" },
  { to: "/deklaraciya/vychet-samozanyatym", label: "Вычет самозанятым" },
  { to: "/deklaraciya/nalog-s-prodazhi-kvartiry", label: "Налог с продажи квартиры" },
  { to: "/deklaraciya/nalog-s-prodazhi-avtomobilya", label: "Налог с продажи авто" },
  { to: "/deklaraciya/nalog-s-prodazhi-uchastka", label: "Продажа участка и дачи" },
  { to: "/deklaraciya/nalog-s-prodazhi-podarennoy", label: "Продажа подарка" },
  { to: "/deklaraciya/nalog-nerezidenta-s-prodazhi", label: "Налог нерезидента" },
  { to: "/deklaraciya/utochnennaya-deklaraciya", label: "Уточнённая декларация" },
  { to: "/deklaraciya/sroki-vozvrata-naloga", label: "Сроки возврата" },
  { to: "/deklaraciya/otkaz-nalogovoy", label: "Отказ в вычете" },
  { to: "/deklaraciya/shtraf-za-nepodachu-deklaracii", label: "Штраф за неподачу" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Самозаполнение: главная и /deklaraciya/* (лендинг теперь живёт на «/»).
  const isSelf = pathname === "/" || pathname.startsWith("/deklaraciya");
  const sections = isSelf ? SELF_SECTIONS : MAIN_SECTIONS;

  // Ссылка-секция лендинга: прокрутка (если уже на лендинге) или переход
  // на лендинг с id секции — там сработает scrollTo (см. SelfService.jsx).
  const onSectionClick = (e, link) => {
    if (!link.scrollTo) return;
    e.preventDefault();
    if (pathname === "/") {
      document.getElementById(link.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: link.scrollTo } });
    }
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link to={isSelf ? "/" : "/pod-klyuch"} className="footer__brand">
              <Logo />
              Налог-сервис
            </Link>
            <p className="footer__tagline">
              Онлайн-сервис профессиональной помощи по заполнению декларации
              3-НДФЛ и оформлению налогового вычета.
            </p>
          </div>

          <nav className="footer__col">
            <h4 className="footer__title">Разделы</h4>
            {sections.map((l) => (
              <Link key={l.label} to={l.to} onClick={(e) => onSectionClick(e, l)}>
                {l.label}
              </Link>
            ))}
          </nav>

          {isSelf && (
            <nav className="footer__col footer__col--articles">
              <h4 className="footer__title">Полезные статьи</h4>
              <div className="footer__articles">
                {SELF_ARTICLES.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </nav>
          )}

          <nav className="footer__col">
            <h4 className="footer__title">Документы</h4>
            <Link to="/politika-konfidencialnosti">
              Политика конфиденциальности
            </Link>
            <Link to="/publichnaya-oferta">Публичная оферта</Link>
          </nav>

          <div className="footer__col">
            <h4 className="footer__title">Контакты</h4>
            <a href={`tel:${company.phoneRaw}`}>{company.phone}</a>
            <a href={`mailto:${company.email}`}>{company.email.toLowerCase()}</a>
            <div className="messengers" style={{ marginTop: 8 }}>
              <a className="messenger messenger--tg" href={company.telegram} target="_blank" rel="noreferrer">
                Telegram
              </a>
              <a className="messenger messenger--max" href={company.max} target="_blank" rel="noreferrer">
                Max
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer__disclaimer">
        <div className="container">
          {company.legalName} · ИНН {company.inn} · ОГРН {company.ogrn} ·{" "}
          {company.address}. Услуги оказываются на основании{" "}
          <Link to="/publichnaya-oferta" style={{ textDecoration: "underline" }}>
            Публичной оферты
          </Link>
          . Сайт носит информационный характер и не является публичной офертой в
          части индивидуальных условий.
        </div>
      </div>

      <div className="footer__bottom container">
        <span>© {year} Налог-сервис. Все права защищены.</span>
        <span>
          Возврат налоговых вычетов НДФЛ по всей России
          <span style={{ opacity: 0.45, marginLeft: 10, fontSize: 11 }}>
            сборка {__BUILD_TS__}
          </span>
        </span>
      </div>
    </footer>
  );
}
