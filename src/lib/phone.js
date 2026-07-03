// Маска российского телефона для полей ввода.
// Правила:
//  - ввод с «9…» → автоматически подставляется префикс: «+7 (9…»;
//  - ведущие «7» или «8» не печатаются — считаются кодом страны;
//  - номер форматируется как +7 (XXX) XXX-XX-XX (максимум 10 цифр);
//  - вставка «89…», «+79…», «79…» нормализуется к одному виду.
export function maskRuPhone(next, prev = "") {
  const deleting = next.length < (prev || "").length;
  let digits = next.replace(/\D/g, "");
  let swallowed = false;
  if (digits.startsWith("7") || digits.startsWith("8")) {
    digits = digits.slice(1);
    swallowed = true;
  }
  if (deleting) {
    // Если стёрт только символ форматирования (скобка/дефис/пробел),
    // удаляем и последнюю цифру — иначе маска вернёт символ обратно.
    const prevDigits = (prev || "").replace(/\D/g, "").replace(/^[78]/, "");
    if (digits === prevDigits) digits = digits.slice(0, -1);
  }
  digits = digits.slice(0, 10);

  if (!digits) {
    if (deleting) return "";
    return swallowed ? "+7 (" : "";
  }
  let out = "+7 (" + digits.slice(0, 3);
  if (digits.length > 3) out += ") " + digits.slice(3, 6);
  if (digits.length > 6) out += "-" + digits.slice(6, 8);
  if (digits.length > 8) out += "-" + digits.slice(8, 10);
  return out;
}

// Телефон заполнен полностью (10 цифр после кода страны)?
export function isCompleteRuPhone(value) {
  return value.replace(/\D/g, "").replace(/^[78]/, "").length === 10;
}
