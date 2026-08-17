// Калькулятор налога с продажи (/deklaraciya/kalkulyator-naloga-s-prodazhi).
//
// Зачем: реклама по продаже недвижимости и авто приводит трафик с вопросом
// «сколько я заплачу?», а лендинг отвечал «заполним декларацию за 199 ₽» —
// человек не получал ответа и уходил. Считаем сумму сразу, а декларацию
// предлагаем как следующий шаг, уже с перенесёнными в анкету цифрами.
//
// Арифметика — src/lib/ndfl/saleTax.js (те же правила, что в мастере).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { fmtRub } from "../lib/format.js";
import { computeSaleTax } from "../lib/ndfl/saleTax.js";
import { SALE_REALTY_BASES, SALE_DEDUCTION } from "../lib/ndfl/refs.js";
import { normalizeMoney } from "../wizard/fields.jsx";
import { todayIso } from "../wizard/validation.js";
import { ymGoal } from "../lib/metrika.js";

const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

export default function SelfServiceKalkulyator() {
  const [kind, setKind] = useState("realty");
  const [price, setPrice] = useState("");
  const [expenses, setExpenses] = useState("");
  const [cadastral, setCadastral] = useState("");
  const [acquireDate, setAcquireDate] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [realtyBasis, setRealtyBasis] = useState("purchase");
  const counted = useRef(false);

  const isRealty = kind === "realty";
  const r = useMemo(
    () =>
      computeSaleTax({
        kind,
        price: num(price),
        expenses: num(expenses),
        cadastral: isRealty ? num(cadastral) : 0,
        acquireDate,
        saleDate,
        realtyBasis: isRealty ? realtyBasis : "purchase",
      }),
    [kind, price, expenses, cadastral, acquireDate, saleDate, realtyBasis, isRealty]
  );

  // Цель отправляем один раз за визит и только когда есть с чего считать —
  // иначе каждое нажатие клавиши в поле цены было бы «расчётом».
  const show = num(price) > 0;
  useEffect(() => {
    if (show && !counted.current) {
      counted.current = true;
      ymGoal("sale_calc", { kind });
    }
  }, [show, kind]);

  // Ссылка в анкету с перенесёнными цифрами: параметры читаются до решётки
  // (см. Wizard.jsx), поэтому порядок именно такой — сначала query, потом хеш.
  const wizardHref = useMemo(() => {
    const p = new URLSearchParams({ s: isRealty ? "prodazha_realty" : "prodazha_auto" });
    if (num(price) > 0) p.set("price", String(num(price)));
    if (num(expenses) > 0) p.set("exp", String(num(expenses)));
    if (isRealty && num(cadastral) > 0) p.set("cad", String(num(cadastral)));
    if (acquireDate) p.set("acq", acquireDate);
    if (saleDate) p.set("sold", saleDate);
    if (isRealty && realtyBasis !== "purchase") p.set("basis", realtyBasis);
    return `/?${p.toString()}#/deklaraciya/anketa`;
  }, [isRealty, price, expenses, cadastral, acquireDate, saleDate, realtyBasis]);

  return (
    <>
      <Seo
        title="Калькулятор налога с продажи квартиры и автомобиля 2026 | Налог-сервис"
        description="Рассчитайте НДФЛ с продажи квартиры, дома, участка или автомобиля: вычет 1 000 000 / 250 000 ₽ или расходы на покупку, правило 0,7 кадастровой стоимости, минимальный срок владения. Бесплатно, без регистрации."
        path="/deklaraciya/kalkulyator-naloga-s-prodazhi"
      />

      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Заполнить самому</Link>
            <span>/ Калькулятор налога с продажи</span>
          </nav>
          <h1 className="page-hero__title">Калькулятор налога с продажи</h1>
          <p className="page-hero__subtitle">
            Посчитаем НДФЛ с продажи квартиры, дома, участка или автомобиля — с
            вычетом, расходами на покупку и проверкой срока владения. Бесплатно и
            без регистрации.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container stax">
          <div className="stax__form card">
            <div className="stax__tabs" role="group" aria-label="Что продали">
              <button
                type="button"
                className={"stax__tab" + (isRealty ? " is-active" : "")}
                onClick={() => setKind("realty")}
              >
                Недвижимость
              </button>
              <button
                type="button"
                className={"stax__tab" + (!isRealty ? " is-active" : "")}
                onClick={() => setKind("auto")}
              >
                Автомобиль
              </button>
            </div>

            <div className="form__field">
              <label htmlFor="stax-price">Цена продажи по договору, ₽</label>
              <input
                id="stax-price"
                type="text"
                inputMode="decimal"
                placeholder="3 000 000"
                value={price}
                onChange={(e) => setPrice(normalizeMoney(e.target.value))}
              />
            </div>

            <div className="form__field">
              <label htmlFor="stax-exp">
                За сколько покупали, ₽ <span className="stax__opt">— если сохранился договор</span>
              </label>
              <input
                id="stax-exp"
                type="text"
                inputMode="decimal"
                placeholder="2 400 000"
                value={expenses}
                onChange={(e) => setExpenses(normalizeMoney(e.target.value))}
              />
            </div>

            {isRealty && (
              <div className="form__field">
                <label htmlFor="stax-cad">
                  Кадастровая стоимость, ₽{" "}
                  <span className="stax__opt">— из выписки ЕГРН</span>
                </label>
                <input
                  id="stax-cad"
                  type="text"
                  inputMode="decimal"
                  placeholder="2 800 000"
                  value={cadastral}
                  onChange={(e) => setCadastral(normalizeMoney(e.target.value))}
                />
              </div>
            )}

            <div className="stax__dates">
              <div className="form__field">
                <label htmlFor="stax-acq">Когда купили</label>
                <input
                  id="stax-acq"
                  type="date"
                  max={todayIso()}
                  value={acquireDate}
                  onChange={(e) => setAcquireDate(e.target.value)}
                />
              </div>
              <div className="form__field">
                <label htmlFor="stax-sold">Когда продали</label>
                <input
                  id="stax-sold"
                  type="date"
                  max={todayIso()}
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>
            </div>

            {isRealty && (
              <div className="form__field">
                <label htmlFor="stax-basis">Как получили объект</label>
                <select
                  id="stax-basis"
                  value={realtyBasis}
                  onChange={(e) => setRealtyBasis(e.target.value)}
                >
                  {SALE_REALTY_BASES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <p className="wiz__note">
                  Наследство, дар от близкого родственника, приватизация, рента и
                  единственное жильё дают льготный срок владения — 3 года вместо 5.
                </p>
              </div>
            )}
          </div>

          <div className="stax__result">
            {!show ? (
              <div className="card stax__empty">
                <p>Введите цену продажи — посчитаем налог сразу, по мере ввода.</p>
              </div>
            ) : r.exempt ? (
              // Освобождён по сроку владения — говорим прямо, что мы не нужны.
              <div className="doc-note doc-note--ok stax__verdict">
                <strong>Налога нет, и декларацию подавать не нужно.</strong>
                <p>
                  Вы владели {isRealty ? "объектом" : "автомобилем"} {r.held}{" "}
                  {r.held === 1 ? "год" : "лет"} — это не меньше минимального срока
                  ({r.minHolding} {r.minHolding === 3 ? "года" : "лет"}, ст. 217.1 НК).
                  Доход от такой продажи НДФЛ не облагается.
                </p>
                <p className="wiz__note">
                  Если налоговая всё-таки пришлёт письмо, ей достаточно ответить
                  пояснением со копией договора — декларация не требуется.
                </p>
              </div>
            ) : (
              <>
                <div className="stax__big card">
                  <span className="stax__big-label">Налог к уплате</span>
                  <span className="stax__big-value">{fmtRub(r.tax)}</span>
                  {r.tax === 0 && (
                    <span className="stax__big-note">
                      Налога нет, но декларацию подать всё равно нужно — иначе штраф
                      1 000 ₽.
                    </span>
                  )}
                </div>

                <table className="stax__table">
                  <tbody>
                    <tr>
                      <th>Доход для налога</th>
                      <td>{fmtRub(r.taxable)}</td>
                    </tr>
                    {r.byCadastral && (
                      <tr className="stax__hl">
                        <th>Считаем по кадастру</th>
                        <td>
                          0,7 × кадастровой = {fmtRub(r.cadastralTaxable)} — это больше
                          цены договора, поэтому по ст. 214.10 НК налог с этой суммы
                        </td>
                      </tr>
                    )}
                    <tr>
                      <th>
                        {r.deductionKind === "expenses"
                          ? "Вычет: расходы на покупку"
                          : "Вычет без документов"}
                      </th>
                      <td>
                        {fmtRub(r.deduction)}
                        {r.deductionKind === "standard" && (
                          <> (лимит {fmtRub(r.limit)})</>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th>Налоговая база</th>
                      <td>{fmtRub(r.base)}</td>
                    </tr>
                    <tr>
                      <th>Ставка</th>
                      <td>13 %</td>
                    </tr>
                  </tbody>
                </table>

                {/* Сравнение вариантов вычета: это самая частая ошибка —
                    человек не знает, что старый договор покупки экономит деньги. */}
                {r.taxByExpenses !== null && r.taxByExpenses !== r.taxByLimit && (
                  <div className="doc-note doc-note--ok">
                    {r.taxByExpenses < r.taxByLimit ? (
                      <>
                        Выгоднее заявить <strong>расходы на покупку</strong>:{" "}
                        {fmtRub(r.taxByExpenses)} вместо {fmtRub(r.taxByLimit)} по
                        вычету — экономия{" "}
                        <strong>{fmtRub(r.taxByLimit - r.taxByExpenses)}</strong>.
                        Приложите к декларации договор покупки и подтверждение оплаты.
                      </>
                    ) : (
                      <>
                        Договор покупки искать не нужно: вычет{" "}
                        {fmtRub(r.limit)} даёт меньше налога ({fmtRub(r.taxByLimit)}{" "}
                        против {fmtRub(r.taxByExpenses)}).
                      </>
                    )}
                  </div>
                )}

                {r.held !== null && !r.exempt && (
                  <p className="wiz__note">
                    Срок владения — {r.held} {r.held === 1 ? "год" : "лет"}, минимальный
                    для освобождения — {r.minHolding}. Поэтому доход декларируется.
                  </p>
                )}

                <div className="stax__cta">
                  <p>
                    Эту сумму нужно задекларировать: 3-НДФЛ подаётся до{" "}
                    <strong>30 апреля</strong> следующего года, налог платится до{" "}
                    <strong>15 июля</strong>.
                  </p>
                  <a
                    className="btn btn--primary btn--lg"
                    href={wizardHref}
                    onClick={() => ymGoal("sale_calc_to_wizard", { kind })}
                  >
                    Заполнить декларацию — 199 ₽
                  </a>
                  <p className="wiz__note">
                    Цифры из калькулятора перенесутся в анкету, останется добавить
                    паспортные данные. Готовые PDF и XML для Личного кабинета ФНС.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container stax__faq">
          <h2 className="section__title">Как считается налог с продажи</h2>
          <div className="stax__faq-grid">
            <article className="card">
              <h3>Срок владения решает всё</h3>
              <p>
                Продали позже минимального срока — налога нет и декларация не нужна.
                Для автомобиля это 3 года, для недвижимости 5 лет, а при наследстве,
                дарении от близкого родственника, приватизации, ренте или если это
                единственное жильё — 3 года (ст. 217.1 НК).
              </p>
            </article>
            <article className="card">
              <h3>Вычет или расходы — что-то одно</h3>
              <p>
                Можно уменьшить доход на фиксированный вычет —{" "}
                {fmtRub(SALE_DEDUCTION.realty)} для жилья и земли,{" "}
                {fmtRub(SALE_DEDUCTION.other)} для автомобиля и иного имущества, — либо
                на документально подтверждённые расходы на покупку. Выбирают то, что
                выгоднее; совмещать нельзя.
              </p>
            </article>
            <article className="card">
              <h3>Правило 0,7 кадастровой стоимости</h3>
              <p>
                Если недвижимость продана дешевле, чем 70 % её кадастровой стоимости,
                налог считают именно с этих 70 % (ст. 214.10 НК). Занизить цену в
                договоре не помогает.
              </p>
            </article>
            <article className="card">
              <h3>Ноль налога — не повод не подавать</h3>
              <p>
                Если срок владения не вышел, декларацию сдают даже при нулевом налоге:
                вычет применяется только по заявлению в декларации. За неподанную
                3-НДФЛ штраф — 1 000 ₽ (ст. 119 НК).
              </p>
            </article>
          </div>
          <p className="wiz__note">
            Калькулятор считает по правилам 2023–2025 годов. Сложные случаи — продажа
            доли, нежилого помещения, имущества в общей собственности —{" "}
            <Link to="/deklaraciya/kontakty">спросите нас</Link>, поможем разобраться.
          </p>
        </div>
      </section>
    </>
  );
}
