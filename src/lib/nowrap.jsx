// Запрет переноса внутри «3-НДФЛ».
//
// Браузер считает дефис законным местом переноса, и в узкой колонке
// получается «3-» в конце строки и «НДФЛ» в начале следующей. На телефоне
// это видно постоянно: название услуги разваливается пополам прямо в первом
// абзаце. CSS тут не помогает — перенос после явного дефиса не отключается
// ни hyphens, ни word-break, нужен отдельный элемент с white-space: nowrap.
//
// Поэтому текст не правим (а значит, и не трогаем ключевое слово в title,
// description и разметке schema.org — там перенос не бывает и подменять
// дефис на неразрывный, рискуя поиском, незачем). Вместо этого оборачиваем
// токен при ОТРИСОВКЕ: функция проходит по children и подменяет «3-НДФЛ» на
// <span class="nowrap">. Вызывается в общих частях страниц — шапке, карточках
// лендингов, вопросах-ответах, — поэтому отдельные страницы остаются чистым
// текстом и о переносах не думают.
import { Children, cloneElement, isValidElement } from "react";

// Все наши случаи устроены одинаково: цифра, дефис, НДФЛ (3-НДФЛ, 2-НДФЛ).
const TOKEN = /(\d-НДФЛ)/g;
const IS_TOKEN = /^\d-НДФЛ$/;

const splitText = (s) => {
  if (!s.includes("-НДФЛ")) return s;
  return s
    .split(TOKEN)
    .map((part, i) =>
      IS_TOKEN.test(part) ? (
        <span key={i} className="nowrap">
          {part}
        </span>
      ) : (
        part
      ),
    );
};

export default function nbr(node) {
  if (typeof node === "string") return splitText(node);
  if (Array.isArray(node)) return Children.map(node, nbr);
  // Элемент с содержимым — спускаемся внутрь, сохраняя сам элемент: так
  // переживают обработку и <strong>, и <Link>, и карточки лендинга.
  if (isValidElement(node) && node.props?.children !== undefined)
    return cloneElement(node, undefined, nbr(node.props.children));
  return node;
}

// Обёртка для целой страницы: <NoBreak> вокруг разметки избавляет от
// необходимости помнить про перенос в каждом абзаце. Внутрь она ничего не
// добавляет — только подменяет текстовые узлы.
export function NoBreak({ children }) {
  return <>{nbr(children)}</>;
}
