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
    order: null, // { id, provider, amount, status, confirmationUrl? }
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
    case "RESET":
      return initialDraft();
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
  // пропасть из-за случайно закрытой вкладки. Первый рендер пропускаем:
  // пока пользователь не решил «Продолжить или заново», пустой начальный
  // черновик не должен затереть сохранённый (иначе клик «Продолжить»
  // спустя 400 мс восстановит уже затёртую пустышку).
  const timer = useRef(0);
  const mounted = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(latest.current), 400);
    return () => clearTimeout(timer.current);
  }, [draft]);

  // Страховка от дебаунса: при уходе со страницы (закрытие вкладки,
  // редирект на страницу оплаты) сбрасываем черновик немедленно.
  useEffect(() => {
    const flushOnLeave = () => {
      if (mounted.current) persist(latest.current);
    };
    window.addEventListener("pagehide", flushOnLeave);
    return () => window.removeEventListener("pagehide", flushOnLeave);
  }, []);

  const value = useMemo(
    () => ({ draft, dispatch, flushDraft: () => persist(latest.current) }),
    [draft]
  );
  return <WizardCtx.Provider value={value}>{children}</WizardCtx.Provider>;
}

export function useWizard() {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error("useWizard вне WizardProvider");
  return ctx;
}
