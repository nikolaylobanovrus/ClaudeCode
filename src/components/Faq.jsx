import { useState } from "react";

// FAQ-аккордеон. JSON-LD FAQPage добавляется на странице через Seo,
// здесь — только визуальная часть.
export default function Faq({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq">
      {items.map((item, i) => (
        <div key={i} className={"faq__item" + (open === i ? " is-open" : "")}>
          <button
            className="faq__q"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
          >
            {item.q}
            <span className="faq__icon" aria-hidden="true">
              +
            </span>
          </button>
          <div className="faq__a">{item.a}</div>
        </div>
      ))}
    </div>
  );
}
