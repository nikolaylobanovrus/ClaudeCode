// Личный кабинет клиента на localStorage: сайт статический, бэкенда нет,
// поэтому аккаунт живёт в браузере пользователя, а бизнес получает
// регистрационные данные письмом (FormSubmit) с ID клиента в теме.

const KEY = "ns.account.v1";

export function getAccount() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function saveAccount(account) {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    /* приватный режим — кабинет проживёт до конца сессии */
  }
}

export function updateAccount(patch) {
  const acc = getAccount();
  if (!acc) return null;
  const next = { ...acc, ...patch };
  saveAccount(next);
  return next;
}

export function clearAccount() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Уникальный числовой ID клиента: секунды с 01.01.2024 (монотонно растут,
// не повторяются) + случайная цифра на случай регистраций в одну секунду.
export function generateClientId() {
  const seconds = Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / 1000);
  return Number(String(seconds) + String(Math.floor(Math.random() * 10)));
}
