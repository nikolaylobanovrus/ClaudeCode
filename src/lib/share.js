// Скачивание и «поделиться» готовыми документами.
// Web Share API (уровень 2, с файлами) работает на телефонах — открывает
// системное меню: Telegram, WhatsApp, почта. На десктопе остаётся скачивание.

export function downloadBlob(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Отзываем URL после клика, чтобы не копить блобы в памяти.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function toFile(bytes, filename, mime) {
  return new File([bytes], filename, { type: mime });
}

export function canShareFiles(files) {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files }));
  } catch {
    return false;
  }
}

export async function shareFiles({ files, title, text }) {
  try {
    await navigator.share({ files, title, text });
    return true;
  } catch (e) {
    // AbortError — пользователь закрыл меню, это не ошибка.
    return e?.name === "AbortError";
  }
}

// Фолбэк: письмо себе через почтовое приложение (вложения через mailto
// невозможны — в письме инструкция, файлы клиент прикладывает сам).
export function mailtoHref(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
