// Статья «Налог с продажи подаренной и унаследованной квартиры»
// (/deklaraciya/nalog-s-prodazhi-podarennoy).
//
// Отдельно от общего разбора продажи, потому что здесь другой срок владения
// (три года вместо пяти), другой отсчёт (со дня смерти наследодателя) и
// особые расходы: с 2019 года можно учесть расходы дарителя или
// наследодателя — об этом почти никто не знает, а разница в налоге кратная.
import { Link } from "react-router-dom";
import DeductionLanding, { LandingBlock } from "../components/DeductionLanding.jsx";
import { selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";
import {
  SALE_DEDUCTION,
  SALE_MIN_HOLDING,
  SALE_CADASTRAL_COEF,
  YEARS,
  taxOn,
} from "../lib/ndfl/refs.js";

const COEF = SALE_CADASTRAL_COEF.toLocaleString("ru-RU");
const YEAR = YEARS[0];
const EX = { sold: 3_000_000, donorCost: 2_400_000 };
const exByVychet = taxOn(EX.sold - SALE_DEDUCTION.realty, YEAR, "sale");
const exByDonor = taxOn(EX.sold - EX.donorCost, YEAR, "sale");

const FAQ = [
  {
    q: "Через сколько лет можно продать подаренную квартиру без налога?",
    a:
      `Через ${SALE_MIN_HOLDING.realtyPrivileged} года, если дарил близкий ` +
      "родственник: супруг, родитель, ребёнок, бабушка или дедушка, внук, брат " +
      `или сестра. Если даритель не близкий родственник — ` +
      `${SALE_MIN_HOLDING.realtyDefault} лет.`,
  },
  {
    q: "С какого дня считается срок при наследстве?",
    a:
      "Со дня смерти наследодателя, а не с даты регистрации права или выдачи " +
      "свидетельства. Поэтому срок нередко уже истёк, хотя выписка ЕГРН свежая.",
  },
  {
    q: "Расходов на покупку у меня не было. Чем уменьшать доход?",
    a:
      `Вычетом ${fmtRub(SALE_DEDUCTION.realty)} — он не требует документов. А с ` +
      "2019 года можно вместо него учесть расходы дарителя или наследодателя на " +
      "приобретение этой квартиры, если он их нёс и сам вычет не использовал. " +
      "Нужны его документы о покупке.",
  },
  {
    q: "Я платил НДФЛ при получении подарка. Это учитывается?",
    a:
      "Да. Если даритель не близкий родственник и вы заплатили налог с подарка, " +
      "сумма, с которой он был уплачен, учитывается в расходах при продаже — " +
      "дважды платить не нужно.",
  },
  {
    q: "Продаю долю, полученную по наследству. Правила те же?",
    a:
      "Да, но есть нюанс: если доля досталась к уже имеющейся, срок владения " +
      "считается с момента приобретения первой доли — объект тот же.",
  },
  {
    q: "Цена ниже кадастровой — что будет?",
    a:
      `Доходом признают ${COEF} кадастровой стоимости на 1 января года продажи ` +
      "(ст. 214.10 НК), независимо от того, как квартира вам досталась.",
  },
];

export default function SelfServiceNalogProdazhaPodarennoy() {
  return (
    <DeductionLanding
      path="/deklaraciya/nalog-s-prodazhi-podarennoy"
      crumb="Продажа подарка и наследства"
      preselect="prodazha_realty"
      h1="Налог с продажи подаренной и унаследованной квартиры"
      lead={
        <>
          Срок владения здесь <strong>{SALE_MIN_HOLDING.realtyPrivileged} года</strong>,
          а не пять, и у наследства он считается со дня смерти наследодателя.
          Продали раньше — доход уменьшают вычетом {fmtRub(SALE_DEDUCTION.realty)}{" "}
          или расходами дарителя.
        </>
      }
      seoTitle="Налог с продажи подаренной и унаследованной квартиры | Налог-сервис"
      seoDescription={`Продажа подаренной или унаследованной квартиры: срок владения ${SALE_MIN_HOLDING.realtyPrivileged} года, отсчёт со дня смерти наследодателя, вычет ${fmtRub(SALE_DEDUCTION.realty)} или расходы дарителя и наследодателя (с 2019 года). Правило ${COEF} кадастровой стоимости и декларация 3-НДФЛ за ${fmtRub(selfService.price)}.`}
      faq={FAQ}
      faqTitle="Частые вопросы про продажу подарка и наследства"
      ctaTitle="Посчитать налог с продажи"
      ctaText="Калькулятор проверит срок владения и подберёт выгодный вариант — бесплатно. Декларация, если нужна, — 199 ₽."
    >
      <LandingBlock title="Сначала срок владения">
        <ul className="instr__steps">
          <li>
            <strong>{SALE_MIN_HOLDING.realtyPrivileged} года</strong> — наследство,
            дар от близкого родственника, приватизация, рента, а также
            единственное жильё.
          </li>
          <li>
            <strong>{SALE_MIN_HOLDING.realtyDefault} лет</strong> — если дарил не
            близкий родственник (например, друг или тётя).
          </li>
          <li>
            <strong>Отсчёт у наследства</strong> — со дня смерти наследодателя;
            у дара — с даты регистрации права.
          </li>
        </ul>
        <p>
          Если срок вышел, налога нет и декларацию подавать не нужно — даже если
          пришло уведомление из налоговой.
        </p>
      </LandingBlock>

      <LandingBlock title="Чем уменьшить доход, если срок не вышел">
        <ul className="instr__steps">
          <li>
            <strong>Вычет {fmtRub(SALE_DEDUCTION.realty)}</strong> — без
            документов, общий за год на всё проданное жильё и землю.
          </li>
          <li>
            <strong>Расходы дарителя или наследодателя</strong> — с 2019 года их
            можно учесть вместо вычета, если он сам этот вычет не использовал.
            Нужны его договор и платёжные документы.
          </li>
          <li>
            <strong>Налог, уплаченный при дарении</strong>, — если подарок был не
            от близкого родственника и вы с него платили НДФЛ.
          </li>
        </ul>
        <p>
          <strong>Пример.</strong> Квартира получена в наследство и продана за{" "}
          {fmtRub(EX.sold)} до истечения трёх лет. По вычету налог —{" "}
          <strong>{fmtRub(exByVychet)}</strong>. Если сохранились документы
          наследодателя о покупке за {fmtRub(EX.donorCost)}, налог —{" "}
          <strong>{fmtRub(exByDonor)}</strong>. Разница в несколько раз, и
          зависит она от найденных в семейном архиве бумаг.
        </p>
      </LandingBlock>

      <LandingBlock title="Сроки и документы">
        <ul className="instr__steps">
          <li>декларация — до 30 апреля года, следующего за продажей;</li>
          <li>налог — до 15 июля;</li>
          <li>
            документы: договор продажи, выписка ЕГРН, свидетельство о праве на
            наследство или договор дарения, документы наследодателя о покупке —
            если заявляете его расходы.
          </li>
        </ul>
        <div className="instr__cta">
          <p>
            Рядом по теме:{" "}
            <Link to="/deklaraciya/nalog-s-prodazhi-kvartiry">
              налог с продажи квартиры
            </Link>
            ,{" "}
            <Link to="/deklaraciya/nalog-s-prodazhi-uchastka">участка и дачи</Link>,{" "}
            <Link to="/deklaraciya/shtraf-za-nepodachu-deklaracii">
              штраф за неподачу
            </Link>
            .
          </p>
          <Link
            to="/deklaraciya/anketa?s=prodazha_realty"
            className="btn btn--green btn--lg"
          >
            Заполнить декларацию — {fmtRub(selfService.price)}
          </Link>
        </div>
      </LandingBlock>
    </DeductionLanding>
  );
}
