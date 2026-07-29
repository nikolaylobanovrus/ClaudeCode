// «Продолжить на другом устройстве»: черновик анкеты упаковывается в URL
// (base64 в query до решётки — читается и при hash-роутинге). Черновик живёт
// в localStorage конкретного браузера, поэтому перенос возможен только через
// ссылку. Оплаты (order/purchases) НЕ переносятся: доступ к документам
// привязан к устройству оплаты.
import { initialDraft } from "../wizard/WizardContext.jsx";

// Поля, которые есть смысл переносить (без оплат и служебного).
const FIELDS = [
  "v", "step", "year", "types", "personal", "incomes", "property",
  "medical", "education", "iis", "insurance", "bank", "sale",
];

const b64encode = (s) => btoa(unescape(encodeURIComponent(s)));
const b64decode = (s) => decodeURIComponent(escape(atob(s)));

// null, если черновик не влезает в разумную длину URL (~2000 символов).
export function draftLink(draft) {
  try {
    const slim = {};
    for (const f of FIELDS) slim[f] = draft[f];
    const code = encodeURIComponent(b64encode(JSON.stringify(slim)));
    const url = `${window.location.origin}/?d=${code}#/deklaraciya/anketa`;
    return url.length <= 2000 ? url : `${window.location.origin}/#/deklaraciya/anketa`;
  } catch {
    return null;
  }
}

export function decodeDraftLink(code) {
  try {
    const obj = JSON.parse(b64decode(decodeURIComponent(code)));
    if (obj?.v !== 2 || !Array.isArray(obj.types)) return null;
    // Поверх свежего initialDraft: недостающие секции получают дефолты.
    return { ...initialDraft(), ...obj, savedAt: null, order: null, purchases: [] };
  } catch {
    return null;
  }
}

// Поделиться ссылкой: системное меню «Поделиться» (мобильные), иначе буфер
// обмена. Возвращает "share" | "copy" | null — по этому строится подпись.
export async function shareDraftLink(draft) {
  const url = draftLink(draft);
  if (!url) return null;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Анкета 3-НДФЛ — продолжить", url });
      return "share";
    }
  } catch {
    /* пользователь закрыл меню — пробуем буфер */
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copy";
  } catch {
    return null;
  }
}
