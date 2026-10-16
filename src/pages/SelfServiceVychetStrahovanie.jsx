// Лендинг «Вычет за страхование жизни» (/deklaraciya/vychet-za-strahovanie-zhizni).
//
// Про этот вычет почти не знают, а договоры страхования жизни есть у многих —
// их часто оформляют вместе с ипотекой. Отсюда и главный вопрос страницы: за
// ипотечную страховку вычет НЕ дают, если договор меньше пяти лет или это
// страхование имущества. Разобрать это важнее, чем расхваливать вычет.
import { Link } from "react-router-dom";
import DeductionLanding, { LandingBlock } from "../components/DeductionLanding.jsx";
import { selfService } from "../data/content.js";
import { fmtRub } from "../lib/format.js";
import { RATE, YEARS, yearRules, refundDeadlineYear } from "../lib/ndfl/refs.js";
import { PROOF_DOCS } from "../lib/ndfl/instrukciya.js";

const openYears = () => {
  const now = new Date().getFullYear();
  return YEARS.filter((y) => refundDeadlineYear(y) >= now).sort((a, b) => b - a);
};

const socialNow = yearRules(YEARS[0]).socialGroup;
const maxBack = Math.round(socialNow * RATE);

const FAQ = [
  {
    q: "Страховку оформили вместе с ипотекой. Вычет будет?",
    a:
      "Только если это добровольное страхование ЖИЗНИ на срок от пяти лет и " +
      "выгодоприобретатель — вы или ваши близкие. Страхование имущества (самой " +
      "квартиры) и полисы на год, которые банк просит продлевать, под вычет не " +
      "подпадают. В договоре со смешанными рисками учитывается только часть " +
      "взноса за страхование жизни — страховая выделяет её в справке.",
  },
  {
    q: "Какой минимальный срок договора?",
    a:
      "Пять лет. Договор на меньший срок права на вычет не даёт, даже если взносы " +
      "платятся регулярно.",
  },
  {
    q: "За супруга или родителей можно вернуть?",
    a:
      "Да: договор может быть в пользу супруга, родителей или детей, в том числе " +
      "усыновлённых и под опекой. Платить взносы при этом должны вы.",
  },
  {
    q: "Сколько вернут?",
    a:
      `${Math.round(RATE * 100)}% от взносов, но в общем социальном лимите ` +
      `${fmtRub(socialNow)} в год — вместе с лечением, обучением и спортом. ` +
      `Максимум ${fmtRub(maxBack)} за год на всё сразу.`,
  },
  {
    q: "Что будет, если расторгнуть договор досрочно?",
    a:
      "Полученный вычет придётся вернуть: страховая удержит НДФЛ из выкупной " +
      "суммы, если вы не принесёте справку из налоговой о том, что вычет не " +
      "получали.",
  },
];

export default function SelfServiceVychetStrahovanie() {
  const years = openYears();

  return (
    <DeductionLanding
      path="/deklaraciya/vychet-za-strahovanie-zhizni"
      crumb="Вычет за страхование жизни"
      preselect="strahovanie"
      h1="Налоговый вычет за страхование жизни"
      lead={
        <>
          За взносы по договору добровольного страхования жизни от пяти лет
          возвращают {Math.round(RATE * 100)}% — в пределах общего социального
          лимита <strong>{fmtRub(socialNow)}</strong> в год, то есть до{" "}
          <strong>{fmtRub(maxBack)}</strong>.
        </>
      }
      seoTitle={`Налоговый вычет за страхование жизни: вернуть до ${fmtRub(maxBack)} | Налог-сервис`}
      seoDescription={`Вычет по договору страхования жизни от 5 лет: ${Math.round(RATE * 100)}% взносов в пределах ${fmtRub(socialNow)} в год. Почему за ипотечную страховку обычно не дают, какие документы нужны и как заполнить 3-НДФЛ за ${fmtRub(selfService.price)}.`}
      faq={FAQ}
      faqTitle="Частые вопросы про вычет за страхование жизни"
      ctaTitle={`Вернуть до ${fmtRub(maxBack)} со страховки`}
      ctaText={`Нужны договор и справка страховой о взносах. Декларация — ${fmtRub(selfService.price)}.`}
    >
      <LandingBlock title="Когда вычет положен">
        <p>Все четыре условия должны выполняться одновременно (пп. 4 п. 1 ст. 219 НК):</p>
        <ul className="instr__steps">
          <li>
            <strong>Добровольное страхование жизни</strong> — не имущества, не
            титула, не от несчастного случая;
          </li>
          <li>
            <strong>срок договора — от пяти лет</strong>;
          </li>
          <li>
            <strong>застрахован</strong> вы сами, супруг, родители или дети;
          </li>
          <li>
            <strong>взносы платили вы</strong>, и это видно из документов.
          </li>
        </ul>
        <p>
          Именно поэтому обычная ипотечная страховка чаще всего не подходит: банк
          требует страховать имущество, а полис на жизнь нередко оформляют на год с
          ежегодным продлением.
        </p>
      </LandingBlock>

      <LandingBlock title="Сколько вернут">
        <ul className="instr__steps">
          <li>
            <strong>{Math.round(RATE * 100)}% взносов</strong> за год;
          </li>
          <li>
            <strong>лимит общий</strong> — {fmtRub(socialNow)} на страхование,
            лечение, обучение и спорт вместе, максимум {fmtRub(maxBack)} возврата;
          </li>
          <li>
            <strong>остаток не переносится</strong> на следующий год.
          </li>
        </ul>
        <p>
          <strong>Пример.</strong> Взносы 60 000 ₽ за год, других социальных
          расходов не было: к возврату 7 800 ₽. Если в том же году было лечение на
          120 000 ₽, лимит уже исчерпан — вместе зачтут только{" "}
          {fmtRub(socialNow)}.
        </p>
      </LandingBlock>

      <LandingBlock title="За какие годы можно подать">
        <p>
          За три последних года. В {new Date().getFullYear()} году открыты{" "}
          {years.length === 1 ? "год" : "годы"}: <strong>{years.join(", ")}</strong>.
          Лимит у каждого года свой:
        </p>
        <ul className="instr__steps">
          {years.map((y) => (
            <li key={y}>
              <strong>{y}</strong> — {fmtRub(yearRules(y).socialGroup)}, к возврату
              до {fmtRub(Math.round(yearRules(y).socialGroup * RATE))}
            </li>
          ))}
        </ul>
      </LandingBlock>

      <LandingBlock title="Какие документы понадобятся">
        <ul className="instr__steps">
          {PROOF_DOCS.strahovanie.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          Если в договоре несколько рисков, попросите страховую выделить в справке
          сумму именно по страхованию жизни — налоговая считает только её.
        </p>
      </LandingBlock>

      <LandingBlock title={`Как оформить декларацию за ${fmtRub(selfService.price)}`}>
        <ol className="instr__steps">
          <li>
            В анкете отмечаете «Платили за страхование жизни», вносите сумму взносов
            и реквизиты страховой из договора.
          </li>
          <li>
            Получаете комплект: 3-НДФЛ в PDF, XML для Личного кабинета ФНС и
            заявление на возврат.
          </li>
          <li>
            Отправляете по{" "}
            <Link to="/deklaraciya/instrukciya">пошаговой инструкции</Link>.
          </li>
        </ol>
        <div className="instr__cta">
          <p>
            Лимит общий, поэтому считать выгоднее вместе с{" "}
            <Link to="/deklaraciya/vychet-za-lechenie">лечением</Link> и{" "}
            <Link to="/deklaraciya/vychet-za-obuchenie">обучением</Link> за тот же
            год.
          </p>
          <Link to="/deklaraciya/anketa?s=strahovanie" className="btn btn--green btn--lg">
            Заполнить декларацию — {fmtRub(selfService.price)}
          </Link>
        </div>
      </LandingBlock>
    </DeductionLanding>
  );
}
