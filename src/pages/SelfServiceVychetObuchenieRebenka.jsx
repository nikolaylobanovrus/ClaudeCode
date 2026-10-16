// Статья «Вычет за обучение ребёнка» (/deklaraciya/vychet-za-obuchenie-rebenka).
//
// Тема из плана (season-plan.md, п. 5). Отдельно от общего разбора обучения:
// у детского вычета свой лимит, он НЕ входит в общий социальный, и у него
// жёсткие условия — очная форма и возраст. Лимиты берём из YEAR_RULES:
// 110 000 ₽ с 2024 года, 50 000 ₽ за более ранние.
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

const childNow = yearRules(YEARS[0]).childEducation;
const maxBack = Math.round(childNow * RATE);
const pct = Math.round(RATE * 100);

const FAQ = [
  {
    q: "Сколько можно вернуть за обучение ребёнка?",
    a:
      `${pct}% расходов, но не больше чем с ${fmtRub(childNow)} в год на каждого ` +
      `ребёнка — до ${fmtRub(maxBack)}. За 2022 и 2023 годы лимит был меньше — ` +
      `${fmtRub(yearRules(2023).childEducation)}.`,
  },
  {
    q: "Этот лимит входит в общие 150 000 ₽?",
    a:
      "Нет, он отдельный: обучение детей считается сверх общего социального " +
      "лимита. Поэтому в одной декларации можно заявить и лечение, и своё " +
      "обучение, и обучение детей.",
  },
  {
    q: "Обязательно ли очное обучение?",
    a:
      "Да. За заочное, вечернее и дистанционное обучение ребёнка вычет не дают. " +
      "Форму обучения подтверждает справка от учебного заведения; у дошкольных " +
      "и дополнительных занятий форма обычно очная по умолчанию.",
  },
  {
    q: "До какого возраста ребёнка?",
    a:
      "До 24 лет, пока он учится очно. Для подопечных — до 18 лет, а после " +
      "окончания опеки вычет сохраняется до 24 лет при очном обучении.",
  },
  {
    q: "Детский сад, кружки, автошкола — подходят?",
    a:
      "Да, если у организации есть лицензия на образовательную деятельность: " +
      "платные занятия в саду, музыкальная и спортивная школы, курсы, " +
      "автошкола. Питание и присмотр в саду в расходы не входят — нужна " +
      "выделенная сумма за обучение.",
  },
  {
    q: "Платил муж, а договор на жену. Кто получит вычет?",
    a:
      "Супруги могут заявить вычет независимо от того, на кого оформлены " +
      "документы: расходы в браке общие. Но проще, когда плательщик и " +
      "заявитель — один человек.",
  },
];

export default function SelfServiceVychetObuchenieRebenka() {
  const years = openYears();

  return (
    <DeductionLanding
      path="/deklaraciya/vychet-za-obuchenie-rebenka"
      crumb="Вычет за обучение ребёнка"
      preselect="obuchenie"
      h1="Налоговый вычет за обучение ребёнка"
      lead={
        <>
          {pct}% расходов на очное обучение ребёнка — с суммы до{" "}
          <strong>{fmtRub(childNow)}</strong> в год на каждого, то есть до{" "}
          <strong>{fmtRub(maxBack)}</strong>. Этот лимит отдельный и не
          уменьшается лечением и своим обучением.
        </>
      }
      seoTitle={`Налоговый вычет за обучение ребёнка: до ${fmtRub(maxBack)} на каждого | Налог-сервис`}
      seoDescription={`Вычет за обучение ребёнка: ${pct}% с суммы до ${fmtRub(childNow)} в год на каждого ребёнка (до 2024 года — ${fmtRub(yearRules(2023).childEducation)}). Очная форма, возраст до 24 лет, лицензия организации, детский сад и кружки, документы и декларация 3-НДФЛ за ${fmtRub(selfService.price)}.`}
      faq={FAQ}
      faqTitle="Частые вопросы про вычет за обучение ребёнка"
      ctaTitle={`Вернуть до ${fmtRub(maxBack)} за каждого ребёнка`}
      ctaText={`Нужны договор, чеки и справка об очной форме. Декларация — ${fmtRub(selfService.price)}.`}
    >
      <LandingBlock title="Сколько вернут">
        <ul className="instr__steps">
          <li>
            <strong>{fmtRub(childNow)} в год на каждого ребёнка</strong> — лимит с
            2024 года, к возврату до {fmtRub(maxBack)}.
          </li>
          <li>
            <strong>Лимит отдельный</strong>: он не входит в общий социальный, то
            есть лечение и своё обучение его не уменьшают.
          </li>
          <li>
            <strong>Считается по каждому ребёнку</strong>: двое детей — два лимита.
          </li>
          <li>
            <strong>Остаток не переносится</strong> на следующий год.
          </li>
        </ul>
        <p>
          <strong>Пример.</strong> Двое детей, за год оплачено 120 000 ₽ и
          80 000 ₽. К возврату {fmtRub(Math.round(childNow * RATE))} за первого
          (лимит) и {fmtRub(Math.round(80_000 * RATE))} за второго — вместе{" "}
          {fmtRub(Math.round(childNow * RATE) + Math.round(80_000 * RATE))}.
        </p>
      </LandingBlock>

      <LandingBlock title="Условия, на которых чаще всего спотыкаются">
        <ul className="instr__steps">
          <li>
            <strong>Очная форма.</strong> За заочное и вечернее обучение ребёнка
            вычета нет.
          </li>
          <li>
            <strong>Возраст до 24 лет.</strong> В год, когда исполняется 24,
            расходы учитываются до даты окончания обучения.
          </li>
          <li>
            <strong>Лицензия у организации.</strong> Её реквизиты указывают в
            договоре; у зарубежных школ нужен документ, подтверждающий статус
            образовательного учреждения.
          </li>
          <li>
            <strong>Платит родитель.</strong> Если в чеках плательщик — сам
            ребёнок, налоговая откажет.
          </li>
        </ul>
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
              <strong>{y}</strong> — {fmtRub(yearRules(y).childEducation)} на
              ребёнка, к возврату до{" "}
              {fmtRub(Math.round(yearRules(y).childEducation * RATE))}
            </li>
          ))}
        </ul>
      </LandingBlock>

      <LandingBlock title="Какие документы понадобятся">
        <ul className="instr__steps">
          {PROOF_DOCS.obuchenie.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <div className="instr__cta">
          <p>
            Своё обучение считается по другому лимиту —{" "}
            <Link to="/deklaraciya/vychet-za-obuchenie">разбор про обучение</Link>.
            Есть ещё{" "}
            <Link to="/deklaraciya/vychet-na-detey">стандартный вычет на детей</Link>{" "}
            — он работает каждый месяц и не связан с расходами.
          </p>
          <Link to="/deklaraciya/anketa?s=obuchenie" className="btn btn--green btn--lg">
            Заполнить декларацию — {fmtRub(selfService.price)}
          </Link>
        </div>
      </LandingBlock>
    </DeductionLanding>
  );
}
