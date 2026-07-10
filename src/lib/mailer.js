// Отправка заявок с форм сайта: письмо через FormSubmit, а при сбое
// почтового сервиса (как 522 у formsubmit.co) — резервная запись заявки
// в Supabase (RPC submit_lead, миграция docs/supabase-migration-leads.sql).
// Оператор видит такие заявки в кабинете /operator.
//
// Возвращает "email" | "db". Бросает ошибку, только если недоступны ОБА
// канала — тогда форма показывает клиенту сообщение об ошибке.
import { sbRpc } from "./supabase.js";

const FORM_ENDPOINT = "https://formsubmit.co/ajax/nalog-service@internet.ru";

export async function sendFormEmail(subject, fields) {
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        _captcha: "false",
        ...fields,
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return "email";
  } catch (mailError) {
    try {
      const id = await sbRpc("submit_lead", { p_kind: subject, p_payload: fields });
      if (!id) throw mailError; // Supabase не настроен — резерва нет
      return "db";
    } catch {
      throw mailError;
    }
  }
}
