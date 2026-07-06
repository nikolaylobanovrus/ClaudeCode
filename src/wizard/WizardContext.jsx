// Состояние мастера декларации: один reducer + черновик в localStorage,
// чтобы клиент мог закрыть вкладку и продолжить позже (и чтобы данные
// пережили редирект на страницу оплаты и обратно).
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { YEARS } from "../lib/ndfl/refs.js";

export const DRAFT_KEY = "ns.decl.draft.v1";

export function initialDraft() {
  return {
    v: 1,
    step: 0,
    savedAt: null,
    year: YEARS[0],
    types: [],
    personal: {
      lastName: "",
      firstName: "",
      middleName: "",
      inn: "",
      birthDate: "",
      birthPlace: "",
      passportSeries: "",
      passportNumber: "",
      passportDate: "",
      passportIssuer: "",
      phone: "",
      oktmo: "",
      ifns: "",
    },
    incomes: [emptyIncome()],
    property: {
      objectKind: "flat", // вид объекта (строка 010 Приложения 7)
      owner: "self", // кто собственник (строка 020, признак налогоплательщика)
      pensioner: false, // перенос вычета на прошлые годы (п. 10 ст. 220 НК)
      buildMethod: "bought", // для домов: построили или купили (строка 030)
      address: "",
      cadastral: "",
      cost: "",
      dateAct: "",
      dateReg: "",
      priorDeduction: "",
      interestPaid: "",
      priorInterest: "",
    },
    medical: { ordinary: "", expensive: "" },
    education: { self: "", children: [] },
    iis: { contribution: "" },
    insurance: { amount: "" },
    bank: { bik: "", account: "" },
    order: null, // { id, provider, amount, status, confirmationUrl?, draftHash? }
    // Оплаченные комплекты: { id, provider, amount, paidAt, draftHash, snapshot }.
    // Одна оплата = один комплект для одного состояния анкеты (draftHash);
    // snapshot — данные анкеты на момент оплаты, из него генерируются документы.
    purchases: [],
  };
}

export function emptyIncome() {
  return { name: "", inn: "", kpp: "", oktmo: "", income: "", withheld: "" };
}

function reducer(state, action) {
  switch (action.type) {
    case "PATCH": // PATCH(section, patch) — точечное обновление раздела
      return { ...state, [action.section]: { ...state[action.section], ...action.patch } };
    case "SET": // SET(key, value) — поле верхнего уровня (year, types)
      return { ...state, [action.key]: action.value };
    case "TOGGLE_TYPE": {
      const on = state.types.includes(action.slug);
      return {
        ...state,
        types: on
          ? state.types.filter((t) => t !== action.slug)
          : [...state.types, action.slug],
      };
    }
    case "ADD_INCOME":
      return { ...state, incomes: [...state.incomes, emptyIncome()] };
    case "REMOVE_INCOME":
      return { ...state, incomes: state.incomes.filter((_, i) => i !== action.index) };
    case "PATCH_INCOME":
      return {
        ...state,
        incomes: state.incomes.map((inc, i) =>
          i === action.index ? { ...inc, ...action.patch } : inc
        ),
      };
    case "ADD_CHILD":
      return {
        ...state,
        education: {
          ...state.education,
          children: [...state.education.children, { amount: "" }],
        },
      };
    case "REMOVE_CHILD":
      return {
        ...state,
        education: {
          ...state.education,
          children: state.education.children.filter((_, i) => i !== action.index),
        },
      };
    case "PATCH_CHILD":
      return {
        ...state,
        education: {
          ...state.education,
          children: state.education.children.map((c, i) =>
            i === action.index ? { ...c, amount: action.amount } : c
          ),
        },
      };
    case "GOTO":
      return { ...state, step: action.step };
    case "SET_ORDER":
      return { ...state, order: action.order };
    // Оплата подтверждена: заказ становится покупкой (со снимком данных),
    // поле order освобождается под следующий заказ.
    case "ADD_PURCHASE": {
      const exists = (state.purchases || []).some((p) => p.id === action.purchase.id);
      return {
        ...state,
        order: null,
        purchases: exists ? state.purchases : [...(state.purchases || []), action.purchase],
      };
    }
    // Покупки переживают сброс: клиент не должен потерять оплаченное.
    case "RESET":
      return { ...initialDraft(), purchases: state.purchases || [] };
    // «Заполнить ещё одну декларацию»: личные данные и счёт остаются,
    // остальное — с чистого листа (другой год/новые данные = новая оплата).
    case "RESET_KEEP_PERSONAL":
      return {
        ...initialDraft(),
        personal: state.personal,
        bank: state.bank,
        purchases: state.purchases || [],
      };
    case "RESTORE":
      return action.draft;
    default:
      return state;
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.v !== 1) return null;
    if (!Array.isArray(draft.purchases)) draft.purchases = [];
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const WizardCtx = createContext(null);

export function WizardProvider({ children }) {
  const [draft, dispatch] = useReducer(reducer, undefined, initialDraft);

  const persist = (d) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...d, savedAt: new Date().toISOString() })
      );
    } catch {
      /* приватный режим — черновик проживёт до конца сессии */
    }
  };

  // Автосохранение черновика с дебаунсом: паспорт и суммы не должны
  // пропасть из-за случайно закрытой вкладки. Пишем ТОЛЬКО после реального
  // изменения черновика в этой сессии (dirty): пустое начальное состояние
  // не должно затереть сохранённый черновик — ни на маунте, ни при уходе
  // со страницы, пока пользователь ничего не менял.
  const timer = useRef(0);
  const dirty = useRef(false);
  const latest = useRef(draft);
  const first = useRef(true);
  latest.current = draft;
  useEffect(() => {
    if (first.current) {
      first.current = false; // маунт — черновик ещё не менялся
      return undefined;
    }
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(latest.current), 400);
    return () => clearTimeout(timer.current);
  }, [draft]);

  // Страховка от дебаунса: при уходе со страницы (закрытие вкладки,
  // редирект на страницу оплаты) сбрасываем изменённый черновик немедленно.
  useEffect(() => {
    const flushOnLeave = () => {
      if (dirty.current) persist(latest.current);
    };
    window.addEventListener("pagehide", flushOnLeave);
    return () => window.removeEventListener("pagehide", flushOnLeave);
  }, []);

  // flushDraft(patch) — немедленная запись; patch применяется поверх
  // актуального состояния (диспатч мог ещё не отрендериться — например,
  // SET_ORDER перед редиректом на страницу оплаты).
  const value = useMemo(
    () => ({
      draft,
      dispatch,
      flushDraft: (patch) => persist({ ...latest.current, ...(patch || {}) }),
    }),
    [draft]
  );
  return <WizardCtx.Provider value={value}>{children}</WizardCtx.Provider>;
}

export function useWizard() {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error("useWizard вне WizardProvider");
  return ctx;
}
