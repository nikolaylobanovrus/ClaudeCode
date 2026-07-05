// Лёгкий клиент Supabase на fetch (без npm-зависимости).
// Клиентские вызовы идут через RPC-функции (register_client, set_situation,
// get_status) — прямого доступа к таблице у роли anon нет.
// Оператор входит по email/паролю (Supabase Auth) и работает с таблицей
// clients под ролью authenticated (RLS-политики в docs/supabase-setup.sql).
import { supabase as cfg } from "../data/content.js";

export function sbConfigured() {
  return Boolean(cfg.url && cfg.anonKey);
}

function baseHeaders(token) {
  return {
    "Content-Type": "application/json",
    apikey: cfg.anonKey,
    Authorization: `Bearer ${token || cfg.anonKey}`,
  };
}

// --- Клиентские RPC ---------------------------------------------------------
export async function sbRpc(fn, args, timeoutMs = 8000) {
  if (!sbConfigured()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Supabase RPC ${fn}: HTTP ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Сессия оператора --------------------------------------------------------
const OP_TOKEN_KEY = "ns.op.token";

export function getOperatorToken() {
  try {
    return localStorage.getItem(OP_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setOperatorToken(token) {
  try {
    if (token) localStorage.setItem(OP_TOKEN_KEY, token);
    else localStorage.removeItem(OP_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function sbOperatorLogin(email, password) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = new Error("login failed");
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  setOperatorToken(data.access_token);
  return data.access_token;
}

// --- Хранилище документов клиентов (bucket client-docs) ----------------------
// Файлы клиентов (паспорта, справки) НЕ отправляются почтой: почтовый сервис
// теряет вложения. Клиент загружает их в приватный bucket (роль anon может
// только записывать — ни читать, ни перечислять), оператор скачивает в своём
// кабинете под ролью authenticated. Политики: docs/supabase-migration-storage.sql.
const DOCS_BUCKET = "client-docs";

const encodePath = (path) =>
  path.split("/").map(encodeURIComponent).join("/");

// Загрузка одного файла клиента. Возвращает имя объекта (без префикса клиента).
export async function sbUploadClientFile(clientId, file, stamp) {
  // Имя объекта: «ГГГГ-ММ-ДД ЧЧ-ММ имя.расш» — момент отправки виден оператору.
  const safeName = String(file.name || "файл")
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_")
    .slice(-80);
  const name = `${stamp} ${safeName}`;
  const res = await fetch(
    `${cfg.url}/storage/v1/object/${DOCS_BUCKET}/${encodePath(`${clientId}/${name}`)}`,
    {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    }
  );
  if (!res.ok) {
    const err = new Error(`upload failed: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return name;
}

// Список файлов клиента (для оператора).
export async function sbListClientFiles(token, clientId) {
  const res = await fetch(`${cfg.url}/storage/v1/object/list/${DOCS_BUCKET}`, {
    method: "POST",
    headers: baseHeaders(token),
    body: JSON.stringify({
      prefix: `${clientId}/`,
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    }),
  });
  if (!res.ok) {
    const err = new Error("list files failed");
    err.status = res.status;
    throw err;
  }
  const items = await res.json();
  // Папки в ответе имеют id=null — оставляем только файлы.
  return items.filter((it) => it.id);
}

// Скачивание файла клиента (для оператора). Возвращает Blob.
export async function sbDownloadClientFile(token, clientId, name) {
  const res = await fetch(
    `${cfg.url}/storage/v1/object/${DOCS_BUCKET}/${encodePath(`${clientId}/${name}`)}`,
    { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = new Error("download failed");
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

// --- Таблица клиентов (только для оператора) ---------------------------------
export async function sbListClients(token) {
  const res = await fetch(
    `${cfg.url}/rest/v1/clients?select=*&order=created_at.desc&limit=500`,
    { headers: baseHeaders(token) }
  );
  if (!res.ok) {
    const err = new Error("list failed");
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Оператор назначает тариф и сумму (или сбрасывает: amount=0).
// declaration_sent держим в синхроне для статуса в кабинете клиента.
export async function sbSetPayment(token, id, { tariff, amount }) {
  const res = await fetch(`${cfg.url}/rest/v1/clients?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...baseHeaders(token), Prefer: "return=minimal" },
    body: JSON.stringify({
      tariff: tariff || "",
      amount: amount || 0,
      declaration_sent: (amount || 0) > 0,
    }),
  });
  if (!res.ok) {
    const err = new Error("update failed");
    err.status = res.status;
    throw err;
  }
}
