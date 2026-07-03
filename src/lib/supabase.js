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
export async function sbRpc(fn, args) {
  if (!sbConfigured()) return null;
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase RPC ${fn}: HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

export async function sbSetDeclaration(token, id, value) {
  const res = await fetch(`${cfg.url}/rest/v1/clients?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...baseHeaders(token), Prefer: "return=minimal" },
    body: JSON.stringify({ declaration_sent: value }),
  });
  if (!res.ok) {
    const err = new Error("update failed");
    err.status = res.status;
    throw err;
  }
}
