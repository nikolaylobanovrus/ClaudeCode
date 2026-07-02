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

// --- Сессия входа -----------------------------------------------------------
// Отсутствие ключа считается «вошёл» — чтобы клиенты, зарегистрированные до
// появления входа, не оказались выброшенными из кабинета.
const SESSION_KEY = "ns.session.v1";

export function isLoggedIn() {
  if (!getAccount()) return false;
  try {
    return localStorage.getItem(SESSION_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setLoggedIn(value) {
  try {
    localStorage.setItem(SESSION_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Хеш пароля (SHA-256): в localStorage не храним пароль открытым текстом.
export async function hashPassword(password) {
  const input = "ns-salt:" + password;
  try {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input)
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Среда без Web Crypto — простой детерминированный фолбэк.
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return "fb-" + (h >>> 0).toString(16);
  }
}
