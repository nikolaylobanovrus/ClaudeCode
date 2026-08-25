// Валидация полей анкеты. Каждая функция возвращает текст ошибки или "".
// Проверки соответствуют форматному контролю ФНС, чтобы декларация
// не «отлетела» на приёме из-за опечатки.

import { digits } from "../lib/format.js";

// ИНН физлица: 12 цифр + две контрольные цифры (алгоритм ФНС).
export function validateInn(value) {
  const inn = digits(value);
  if (!inn) return "Укажите ИНН";
  if (inn.length !== 12) return "ИНН физического лица — 12 цифр";
  const check = (weights) =>
    weights.reduce((s, w, i) => s + w * Number(inn[i]), 0) % 11 % 10;
  const n11 = check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
  const n12 = check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
  if (n11 !== Number(inn[10]) || n12 !== Number(inn[11]))
    return "Проверьте ИНН — контрольные цифры не сходятся";
  return "";
}

// ИНН организации (работодателя): 10 цифр.
export function validateInnOrg(value) {
  const inn = digits(value);
  if (!inn) return "Укажите ИНН работодателя";
  if (inn.length === 12) return validateInn(inn); // работодатель-ИП
  if (inn.length !== 10) return "ИНН организации — 10 цифр (ИП — 12)";
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const ctrl = weights.reduce((s, w, i) => s + w * Number(inn[i]), 0) % 11 % 10;
  if (ctrl !== Number(inn[9])) return "Проверьте ИНН — контрольная цифра не сходится";
  return "";
}

export function validateKpp(value) {
  const kpp = digits(value);
  if (!kpp) return ""; // у ИП КПП нет — поле необязательное
  if (kpp.length !== 9) return "КПП — 9 цифр";
  return "";
}

// Телефон обязателен: печатается на титуле декларации и попадает в чек
// 54-ФЗ при оплате (ЮKassa требует контакт покупателя).
export function validatePhone(value) {
  const d = digits(value);
  if (!d) return "Укажите номер телефона";
  if (!/^[78]\d{10}$/.test(d)) return "Телефон — 11 цифр, начиная с +7 или 8";
  return "";
}

export function validateBik(value) {
  const bik = digits(value);
  if (!bik) return "Укажите БИК банка";
  if (!/^04\d{7}$/.test(bik)) return "БИК — 9 цифр и начинается с 04";
  return "";
}

// Номер счёта: 20 цифр + ключевание по БИК (веса 7-1-3, приложение к
// положению ЦБ РФ). Считается по последним 3 цифрам БИК + счёту.
export function validateAccount(value, bik) {
  const acc = digits(value);
  if (!acc) return "Укажите номер счёта";
  if (acc.length !== 20) return "Номер счёта — 20 цифр";
  const b = digits(bik);
  if (b.length === 9) {
    const s = b.slice(-3) + acc;
    const weights = [7, 1, 3];
    const sum = [...s].reduce((t, ch, i) => t + Number(ch) * weights[i % 3], 0);
    if (sum % 10 !== 0) return "Счёт не соответствует БИК — проверьте реквизиты";
  }
  return "";
}

// Мягкая проверка: возврат приходит только на счета физлица.
export function accountKindWarning(value) {
  const acc = digits(value);
  if (acc.length !== 20) return "";
  const ok = ["40817", "40820", "423", "426"].some((p) => acc.startsWith(p));
  return ok
    ? ""
    : "Обычно счёт физлица начинается с 40817 или 423 — убедитесь, что это ваш счёт, а не номер карты";
}

export function validateOktmo(value) {
  const o = digits(value);
  if (!o) return "Укажите ОКТМО";
  if (o.length !== 8 && o.length !== 11) return "ОКТМО — 8 или 11 цифр";
  return "";
}

export function validateIfns(value) {
  const c = digits(value);
  if (!c) return "Укажите код вашей налоговой инспекции";
  if (c.length !== 4) return "Код инспекции — 4 цифры";
  return "";
}

export function validatePassportSeries(value) {
  const s = digits(value);
  if (!s) return "Укажите серию паспорта";
  if (s.length !== 4) return "Серия — 4 цифры";
  return "";
}

export function validatePassportNumber(value) {
  const n = digits(value);
  if (!n) return "Укажите номер паспорта";
  if (n.length !== 6) return "Номер — 6 цифр";
  return "";
}

export function validateName(value, label) {
  if (!String(value || "").trim()) return `Укажите ${label}`;
  return "";
}

// Кадастровый номер: группы цифр, разделённые двоеточиями (обычно 4 группы,
// напр. 74:36:0000000:1234). Проверка мягкая — формат кадастрового номера у
// разных объектов различается длиной групп.
export function validateCadastral(value) {
  const v = String(value || "").trim();
  if (!v) return "Укажите кадастровый номер";
  if (!/^\d{1,3}(:\d{1,14}){2,3}$/.test(v))
    return "Кадастровый номер — цифры, разделённые двоеточиями (напр. 74:36:0000000:1234)";
  return "";
}

// Сегодняшняя дата в формате YYYY-MM-DD по ЛОКАЛЬНОМУ времени пользователя.
// new Date("YYYY-MM-DD") парсится как полночь UTC — сравнение с ней ошибочно
// отбраковывало «сегодня» у пользователей восточнее Гринвича сразу после
// местной полуночи. Строки ISO сравниваются лексикографически корректно.
export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function validateDate(value, label = "дату") {
  if (!value) return `Укажите ${label}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime()))
    return "Некорректная дата";
  if (value > todayIso()) return "Дата не может быть в будущем";
  if (value.slice(0, 4) < "1900") return "Проверьте год";
  return "";
}

export function validateMoney(value, label = "сумму") {
  const n = Number(value);
  if (!value && value !== 0) return `Укажите ${label}`;
  if (!Number.isFinite(n) || n < 0) return "Сумма должна быть числом";
  if (n > 1_000_000_000) return "Проверьте сумму — слишком большая";
  return "";
}

const positive = (v) => Number(v) > 0;
// Режимы декларации — дубль modeOf из data/wizard.js (импорт оттуда сделал бы
// цикл модулей). Важно именно «ЧИСТАЯ продажа»: у неё нет шага «Доходы», а у
// комбинированной он есть, и реквизиты работодателей там обязательны.
const SALE_TYPES = ["prodazha_auto", "prodazha_realty"];
const isPureSale = (draft) => {
  const types = draft?.types || [];
  return types.some((t) => SALE_TYPES.includes(t)) && !types.some((t) => !SALE_TYPES.includes(t));
};

// --- Пошаговая валидация ------------------------------------------------------
// Возвращает объект { имяПоля: текстОшибки } — пустой объект, если всё в порядке.
export function validateStep(stepKey, draft) {
  const e = {};
  const has = (t) => (draft.types || []).includes(t);

  if (stepKey === "types") {
    if (!(draft.types || []).length) e.types = "Выберите хотя бы один вычет";
    const corr = Number(draft.correction);
    if (draft.correction !== undefined && (!Number.isInteger(corr) || corr < 0 || corr > 99))
      e.correction = "Номер корректировки — целое число от 1 до 99 (0 — первичная)";
  }

  if (stepKey === "personal") {
    const p = draft.personal || {};
    put(e, "lastName", validateName(p.lastName, "фамилию"));
    put(e, "firstName", validateName(p.firstName, "имя"));
    put(e, "inn", validateInn(p.inn));
    // С формы за 2024 год при указанном ИНН паспорт и дата рождения не
    // обязательны: в XML блок СведФЛ при ИНН вообще не выгружается (choice
    // в XSD ФНС), на бумажном титуле поля разрешено оставить пустыми.
    // ИНН в анкете обязателен всегда (проверка выше), поэтому условие —
    // только по году. За 2022–2023 паспорт обязателен: схема требует СведФЛ1.
    const passportOptional = Number(draft.year) >= 2024;
    if (passportOptional) {
      // Проверяем только формат уже введённого — пустое разрешено.
      if (p.birthDate) put(e, "birthDate", validateDate(p.birthDate, "дату рождения"));
      if (digits(p.passportSeries))
        put(e, "passportSeries", validatePassportSeries(p.passportSeries));
      if (digits(p.passportNumber))
        put(e, "passportNumber", validatePassportNumber(p.passportNumber));
      if (p.passportDate) put(e, "passportDate", validateDate(p.passportDate, "дату выдачи"));
    } else {
      put(e, "birthDate", validateDate(p.birthDate, "дату рождения"));
      put(e, "passportSeries", validatePassportSeries(p.passportSeries));
      put(e, "passportNumber", validatePassportNumber(p.passportNumber));
      put(e, "passportDate", validateDate(p.passportDate, "дату выдачи"));
      put(e, "passportIssuer", validateName(p.passportIssuer, "кем выдан паспорт"));
    }
    put(e, "oktmo", validateOktmo(p.oktmo));
    put(e, "ifns", validateIfns(p.ifns));
    put(e, "phone", validatePhone(p.phone));
  }

  if (stepKey === "income") {
    // МЯГКАЯ проверка: реквизиты из справки о доходах разрешено внести
    // позже (справки часто нет под рукой — главный обрыв воронки).
    // Проверяем только ФОРМАТ уже введённого; полнота требуется на шаге
    // «Проверка» (см. ветку "review") — перед документами всё равно нужны
    // все реквизиты, но к тому моменту человек уже видит свою сумму.
    (draft.incomes || []).forEach((inc, i) => {
      if (digits(inc.inn)) put(e, `income.${i}.inn`, validateInnOrg(inc.inn));
      put(e, `income.${i}.kpp`, validateKpp(inc.kpp));
      if (digits(inc.oktmo)) put(e, `income.${i}.oktmo`, validateOktmo(inc.oktmo));
      if (inc.income !== "") put(e, `income.${i}.income`, validateMoney(inc.income, "доход"));
      if (inc.withheld !== "")
        put(e, `income.${i}.withheld`, validateMoney(inc.withheld, "удержанный налог"));
      if (
        !e[`income.${i}.withheld`] &&
        inc.income !== "" &&
        inc.withheld !== "" &&
        Number(inc.withheld) > Number(inc.income)
      )
        put(e, `income.${i}.withheld`, "Налог не может быть больше дохода");
    });
  }

  // Шаг «Проверка» возвратной декларации: здесь реквизиты доходов становятся
  // обязательными — дальше формируются документы, ФНС требует все поля.
  if (stepKey === "review" && !isPureSale(draft)) {
    const list = draft.incomes || [];
    if (!list.length) e.incomes = "Добавьте хотя бы одного работодателя";
    list.forEach((inc, i) => {
      put(e, `income.${i}.name`, validateName(inc.name, "название работодателя"));
      put(e, `income.${i}.inn`, validateInnOrg(inc.inn));
      put(e, `income.${i}.kpp`, validateKpp(inc.kpp));
      put(e, `income.${i}.oktmo`, validateOktmo(inc.oktmo));
      put(e, `income.${i}.income`, validateMoney(inc.income, "доход"));
      if (!positive(inc.income)) put(e, `income.${i}.income`, "Доход должен быть больше нуля");
      put(e, `income.${i}.withheld`, validateMoney(inc.withheld, "удержанный налог"));
      if (
        !e[`income.${i}.withheld`] &&
        Number(inc.withheld) > Number(inc.income)
      )
        put(e, `income.${i}.withheld`, "Налог не может быть больше дохода");
    });
  }

  if (stepKey === "details") {
    if (has("kvartira")) {
      const pr = draft.property || {};
      put(e, "property.address", validateName(pr.address, "адрес объекта"));
      put(e, "property.cost", validateMoney(pr.cost, "стоимость"));
      if (!positive(pr.cost)) put(e, "property.cost", "Укажите стоимость жилья");
      put(e, "property.dateReg", validateDate(pr.dateReg, "дату регистрации права"));
    }
    if (has("ipoteka")) {
      const pr = draft.property || {};
      put(e, "property.interestPaid", validateMoney(pr.interestPaid, "сумму процентов"));
      if (!positive(pr.interestPaid))
        put(e, "property.interestPaid", "Укажите уплаченные проценты");
      if (!has("kvartira"))
        put(e, "property.address", validateName(pr.address, "адрес объекта"));
    }
    if (has("lechenie")) {
      const m = draft.medical || {};
      if (!positive(m.ordinary) && !positive(m.expensive))
        e["medical.ordinary"] = "Укажите расходы на лечение (обычное или дорогостоящее)";
    }
    if (has("obuchenie")) {
      const ed = draft.education || {};
      const childSum = (ed.children || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
      if (!positive(ed.self) && !positive(childSum))
        e["education.self"] = "Укажите расходы на обучение — своё или детей";
    }
    if (has("iis") && !positive(draft.iis?.contribution))
      e["iis.contribution"] = "Укажите сумму взносов на ИИС за год";
    if (has("strahovanie") && !positive(draft.insurance?.amount))
      e["insurance.amount"] = "Укажите взносы по договору страхования";
    if (has("sport") && !positive(draft.sport?.amount))
      e["sport.amount"] = "Укажите расходы на физкультурно-оздоровительные услуги";
  }

  if (stepKey === "bank") {
    const b = draft.bank || {};
    put(e, "bik", validateBik(b.bik));
    put(e, "account", validateAccount(b.account, b.bik));
  }

  if (stepKey === "sale") {
    // Объектов может быть несколько — ошибки нумеруем: sale.<индекс>.<поле>.
    const items = Array.isArray(draft.sales)
      ? draft.sales
      : draft.sale && typeof draft.sale === "object"
        ? [draft.sale]
        : [];
    items.forEach((s, i) => {
      const key = (f) => `sale.${i}.${f}`;
      const realty = (s.objectKind || (s.kind === "realty" ? "flat" : "auto")) !== "auto";
      put(e, key("price"), validateMoney(s.price, "цену продажи"));
      if (!e[key("price")] && !positive(s.price)) put(e, key("price"), "Укажите цену продажи");
      put(e, key("saleDate"), validateDate(s.saleDate, "дату продажи"));
      if (!e[key("saleDate")] && String(s.saleDate).slice(0, 4) !== String(draft.year))
        put(
          e,
          key("saleDate"),
          `Декларация подаётся за ${draft.year} год, поэтому дата продажи должна быть в ${draft.year} году. ` +
            "Продали в другом году — вернитесь на шаг «Ситуация» и выберите его."
        );
      if (realty) {
        // Кадастровый номер и стоимость нужны для «Расчёта к Приложению 1»
        // (сверка по правилу кадастр × 0,7) — в XML все поля обязательны.
        put(e, key("cadastralNumber"), validateCadastral(s.cadastralNumber));
        put(e, key("cadastralValue"), validateMoney(s.cadastralValue, "кадастровую стоимость"));
        if (!e[key("cadastralValue")] && !positive(s.cadastralValue))
          put(e, key("cadastralValue"), "Укажите кадастровую стоимость (можно узнать на сайте Росреестра)");
        // Дата приобретения — для проверки срока владения.
        put(e, key("acquireDate"), validateDate(s.acquireDate, "дату приобретения"));
        if (!e[key("acquireDate")] && !e[key("saleDate")] && s.acquireDate > s.saleDate)
          put(e, key("acquireDate"), "Дата приобретения не может быть позже даты продажи");
      }
      put(e, key("buyerName"), validateName(s.buyerName, "покупателя"));
      if (s.deductionKind === "expenses") {
        put(e, key("expenses"), validateMoney(s.expenses, "расходы на покупку"));
        if (!e[key("expenses")] && !positive(s.expenses))
          put(e, key("expenses"), "Укажите расходы на покупку");
      }
      const binn = digits(s.buyerInn);
      if (binn && binn.length !== 10 && binn.length !== 12)
        put(e, key("buyerInn"), "ИНН — 12 цифр (физлицо) или оставьте пустым");
    });
  }

  return e;
}

function put(errors, key, message) {
  if (message && !errors[key]) errors[key] = message;
}
