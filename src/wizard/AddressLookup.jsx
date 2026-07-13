// Поле «Адрес прописки» с подсказками: выбрал адрес — коды ИФНС и ОКТМО
// подставились сами (как в ЛК ФНС). Адрес живёт только в state компонента:
// в черновик НЕ пишется (draft хешируется для привязки оплаты — лишнее
// поле «слетало» бы после оплаты) и в декларацию не попадает.
// Показывается только при включённом серверном флаге address_lookup.
import { useEffect, useRef, useState } from "react";
import { useWizard } from "./WizardContext.jsx";
import { useFeatureFlag } from "../lib/featureFlags.js";
import { suggestAddress } from "../lib/addressLookup.js";
import { ymGoal } from "../lib/metrika.js";

const DEBOUNCE_MS = 350;

export default function AddressLookup() {
  const enabled = useFeatureFlag("address_lookup");
  const { dispatch } = useWizard();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]); // [{value, oktmo, taxOffice}]
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null); // {kind: "ok"|"err", text}
  const timer = useRef(0);
  const seq = useRef(0); // отбрасываем ответы устаревших запросов
  const boxRef = useRef(null);

  // Клик мимо списка закрывает подсказки.
  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!enabled) return null;

  const onInput = (v) => {
    setQuery(v);
    setNote(null);
    clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const my = ++seq.current;
      try {
        const list = await suggestAddress(v.trim());
        if (my !== seq.current) return;
        setItems(list);
        setOpen(true);
      } catch {
        if (my !== seq.current) return;
        setItems([]);
        setOpen(false);
      }
    }, DEBOUNCE_MS);
  };

  const pick = (s) => {
    setQuery(s.value);
    setItems([]);
    setOpen(false);
    const ifns = String(s.taxOffice || "").replace(/\D/g, "");
    const oktmo = String(s.oktmo || "").replace(/\D/g, "");
    if (ifns || oktmo) {
      dispatch({
        type: "PATCH",
        section: "personal",
        patch: { ...(ifns ? { ifns } : {}), ...(oktmo ? { oktmo } : {}) },
      });
      setNote({
        kind: "ok",
        text:
          "Определили по адресу: " +
          [ifns && `ИФНС ${ifns}`, oktmo && `ОКТМО ${oktmo}`]
            .filter(Boolean)
            .join(", ") +
          ". Проверьте значения в полях ниже.",
      });
      ymGoal("address_lookup");
    } else {
      setNote({
        kind: "err",
        text: "Для этого адреса реквизиты не определились — уточните адрес до улицы или дома, либо заполните коды вручную.",
      });
    }
  };

  return (
    <div className="form__field addr" ref={boxRef}>
      <label>Адрес прописки — определим инспекцию и ОКТМО</label>
      <input
        type="text"
        value={query}
        placeholder="Начните вводить: город, улица, дом…"
        autoComplete="off"
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
      />
      {open && items.length > 0 && (
        <ul className="addr__list" role="listbox">
          {items.map((s, i) => (
            <li key={`${s.value}-${i}`}>
              <button type="button" role="option" onClick={() => pick(s)}>
                {s.value}
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <div className={"doc-note doc-note--" + note.kind} style={{ marginTop: 8 }}>
          {note.text}
        </div>
      )}
      <p className="addr__privacy">
        Адрес нужен только для определения реквизитов — в декларацию не
        попадает и нигде не сохраняется.
      </p>
    </div>
  );
}
