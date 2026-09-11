// Состояние мастера декларации: один reducer + черновик в localStorage,
// чтобы клиент мог закрыть вкладку и продолжить позже (и чтобы данные
// пережили редирект на страницу оплаты и обратно).
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { YEARS } from "../lib/ndfl/refs.js";

export const DRAFT_KEY = "ns.decl.draft.v1";

export function initialDraft() {
  return {
    v: 2, // v2: шаги переставлены (доходы/расходы до паспорта) — см. loadDraft
    step: 0,
    savedAt: null,
    year: YEARS[0],
    types: [],
    // Номер корректировки: 0 — первичная декларация, 1+ — уточнённая
    // (титул «Номер корректировки», в XML — атрибут НомКорр).
    correction: 0,
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
    // Стандартный вычет на детей (пп. 4 п. 1 ст. 218). С 2025 года работодатель
    // даёт его сам, без заявления, поэтому чаще всего он уже в справке — тогда
    // строка 080 выходит нулевой, а декларация просто отражает факт. Возвращать
    // по декларации приходится тем, кому агент вычет не дал или дал не полностью.
    standard: {
      children: [],          // [{ order: "1"|"2"|"3", disabled: bool }]
      singleParent: false,   // единственный родитель — вычет удваивается
      providedByAgent: "",   // строка 070: сколько уже дал работодатель
      months: "",            // ручное число месяцев (пусто — считаем сами)
      // Доход по месяцам из справки о доходах, 12 значений. Вычет положен по
      // месяц, в котором доход нарастающим итогом ещё не превысил предел, а
      // доход почти никогда не ровный: премия, тринадцатая зарплата, выход на
      // работу не с января. По среднему за год месяцы выходят другими.
      monthly: [],
    },
    // Вычет на долгосрочные сбережения (ст. 219.2): договоры ПДС, НПО и
    // страхования жизни от 10 лет. Строки 235–280 Приложения 5.
    savings: { contracts: [], byAgent: "", simplified: "" },
    // Социальные вычеты, уже предоставленные работодателем (строка 181) и в
    // упрощённом порядке (182). Без них строка 190 завышается.
    socialProvided: { byAgent: "", simplified: "" },
    medical: { ordinary: "", expensive: "" },
    education: { self: "", children: [] },
    // Реквизиты договора нужны для листа «Расчёт к Приложению 5»: без него
    // строки 160 и 210 Приложения 5 повисают без расчёта (Порядок, п. 78).
    iis: {
      contribution: "",
      brokerName: "", brokerInn: "", brokerKpp: "",
      contractDate: "", contractNumber: "", openDate: "",
      // Счёт, открытый с 2024 года, идёт по статье 219.2 (строка 250), а не
      // по 219.1 (строка 210) — это разные вычеты с разными правилами.
      newAccount: false,
    },
    insurance: {
      amount: "",
      insurerName: "", insurerInn: "", insurerKpp: "",
      contractDate: "", contractNumber: "",
    },
    sport: { amount: "" },
    bank: { bik: "", account: "" },
    // Продажа имущества: СПИСОК проданных объектов — за год человек мог
    // продать и машину, и квартиру, и всё это идёт одной декларацией.
    // Заполняется на шаге «Продажа»; в возвратной декларации не используется.
    // Старые черновики хранили один объект в поле sale — см. loadDraft.
    sales: [emptySale()],
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

export function emptySale() {
  return {
    kind: "auto", // "auto" (иное имущество) | "realty" (недвижимость)
    price: "", // цена продажи по ДКП
    saleDate: "", // дата договора
    deductionKind: "standard", // "standard" (250 000 / 1 000 000 ₽) | "expenses"
    expenses: "", // расходы на покупку (если deductionKind === "expenses")
    buyerName: "", // ФИО покупателя
    buyerInn: "", // ИНН покупателя (необязательно)
    // --- Только недвижимость (kind === "realty") ---
    objectKind: "flat", // вид объекта (квартира/дом/комната/участок)
    cadastralNumber: "", // кадастровый номер (для «Расчёта к Приложению 1»)
    cadastralValue: "", // кадастровая стоимость, ₽ (правило кадастр × 0,7)
    acquireDate: "", // дата приобретения (для проверки срока владения)
    realtyBasis: "purchase", // основание приобретения (влияет на льготный срок)
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "PATCH": // PATCH(section, patch) — точечное обновление раздела
      return { ...state, [action.section]: { ...state[action.section], ...action.patch } };
    case "APPLY_PATCH":
      // Патч из распознавания документов: секции уже смержены mergePatch
      // (пользовательский ввод не затирается), применяем верхним уровнем.
      return { ...state, ...action.patch };
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
    case "ADD_SALE":
      return { ...state, sales: [...(state.sales || []), emptySale()] };
    case "REMOVE_SALE": {
      const rest = (state.sales || []).filter((_, i) => i !== action.index);
      // Пустой список сломал бы шаг «Продажа» — держим хотя бы один объект.
      return { ...state, sales: rest.length ? rest : [emptySale()] };
    }
    case "PATCH_SALE":
      return {
        ...state,
        sales: (state.sales || []).map((s, i) =>
          i === action.index ? { ...s, ...action.patch } : s
        ),
      };
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
    case "ADD_SAVING":
      return {
        ...state,
        savings: {
          ...state.savings,
          contracts: [...(state.savings?.contracts || []),
            { kind: "pds", name: "", inn: "", kpp: "", date: "", number: "", amount: "" }],
        },
      };
    case "PATCH_SAVING":
      return {
        ...state,
        savings: {
          ...state.savings,
          contracts: (state.savings?.contracts || []).map((c, i) =>
            i === action.index ? { ...c, ...action.patch } : c),
        },
      };
    case "DROP_SAVING":
      return {
        ...state,
        savings: {
          ...state.savings,
          contracts: (state.savings?.contracts || []).filter((_, i) => i !== action.index),
        },
      };
    case "SET_STD_MONTH": {
      const monthly = [...(state.standard?.monthly || [])];
      while (monthly.length < 12) monthly.push("");
      monthly[action.index] = action.value;
      return { ...state, standard: { ...state.standard, monthly } };
    }
    case "ADD_STD_CHILD":
      return {
        ...state,
        standard: {
          ...state.standard,
          children: [...(state.standard?.children || []), { order: "1", disabled: false }],
        },
      };
    case "PATCH_STD_CHILD":
      return {
        ...state,
        standard: {
          ...state.standard,
          children: (state.standard?.children || []).map((c, i) =>
            i === action.index ? { ...c, ...action.patch } : c
          ),
        },
      };
    case "DROP_STD_CHILD":
      return {
        ...state,
        standard: {
          ...state.standard,
          children: (state.standard?.children || []).filter((_, i) => i !== action.index),
        },
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
      // Черновик приходит из localStorage или из ссылки ?d= — и в обоих
      // случаях мог быть собран версией сайта, не знавшей части полей.
      return withDefaults(action.draft);
    default:
      return state;
  }
}

// Черновики v1 сохранены при старом порядке шагов (types, personal, income,
// details, …) — номер текущего шага хранится индексом, поэтому при
// перестановке шагов индекс переезжает: personal 1→3, income 2→1,
// details 3→2. Данные анкеты не меняются (хеш оплаты не затрагивается).
const V1_STEP_MAP = { 1: 3, 2: 1, 3: 2 };

// Разделы, появившиеся позже самого черновика, добираем из initialDraft.
//
// Это не украшение, а защита от целого класса аварий. RESTORE кладёт черновик
// в состояние КАК ЕСТЬ, без слияния, поэтому у вернувшегося человека попросту
// нет полей, добавленных после того дня, когда он заполнял анкету. Шаг,
// который читает такое поле в лоб (`draft.socialProvided.byAgent`), падает на
// рендере, а error boundary в приложении нет — вся анкета уходит в белый
// экран, причём молча: человек жмёт «Далее», и «ничего не происходит».
//
// Ровно это и случилось 10.09.2026 с полями standard / socialProvided /
// savings: раньше каждое новое поле дописывали сюда руками, и на третьем
// подряд забыли. Поэтому больше не перечисляем — добираем всё разом.
//
// Вызывается в ДВУХ местах: здесь (черновик из localStorage) и в RESTORE
// (ссылка-черновик ?d= с другого устройства могла быть собрана старой
// версией сайта). Уже заполненные поля не трогаем.
export function withDefaults(draft) {
  if (!draft || typeof draft !== "object") return draft;
  const base = initialDraft();
  for (const key of Object.keys(base))
    if (draft[key] === undefined) draft[key] = base[key];
  return draft;
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.v === 1) {
      draft.step = V1_STEP_MAP[draft.step] ?? draft.step;
      draft.v = 2;
    }
    if (draft?.v !== 2) return null;
    if (!Array.isArray(draft.purchases)) draft.purchases = [];
    // Продажа: раньше объект был один (поле sale), теперь их список. Старый
    // черновик переносим в первый элемент, чтобы человек не потерял введённое.
    // Само поле sale не трогаем: снимки оплаченных комплектов
    // (purchases[].snapshot) хранят именно его, и документы по ним обязаны
    // собираться по-прежнему — расчёт умеет читать оба вида (см. calc.js).
    if (!Array.isArray(draft.sales))
      draft.sales = [draft.sale && typeof draft.sale === "object" ? draft.sale : emptySale()];
    // Черновики до появления уточнёнки: первичная декларация.
    if (draft.correction === undefined) draft.correction = 0;
    // Разделы, появившиеся позже самого черновика, добираем из initialDraft.
    //
    // Это не украшение, а защита от целого класса аварий. RESTORE кладёт
    // сохранённый черновик в состояние КАК ЕСТЬ, без слияния, поэтому у
    // вернувшегося человека попросту нет полей, добавленных после того дня,
    // когда он заполнял анкету. Шаг, который читает такое поле в лоб
    // (`draft.socialProvided.byAgent`), падает на рендере, а error boundary
    // в приложении нет — вся анкета уходит в белый экран, причём молча:
    // человек жмёт «Далее» и «ничего не происходит».
    //
    // Ровно это и случилось 10.09.2026 с полями standard / socialProvided /
    // savings: раньше каждое новое поле дописывали сюда руками, и на третьем
    // подряд забыли. Поэтому больше не перечисляем — добираем всё разом.
    return withDefaults(draft);
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
