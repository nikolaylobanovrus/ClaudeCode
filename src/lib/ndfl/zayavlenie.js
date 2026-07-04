// Заявление о распоряжении путём возврата суммы, формирующей положительное
// сальдо ЕНС (КНД 1112542) — отдельный PDF. Заявление о возврате уже входит
// в декларацию (Приложение к Разделу 1), этот файл — дубль на случай, когда
// возврат оформляют после камеральной проверки отдельным заявлением.
import { createDoc, makeSheet, drawFooter, drawSignature } from "./pdfPage.js";
import { fmtDate } from "./model.js";

const rub = (n) => String(Math.max(0, Math.round(Number(n) || 0)));

export async function buildRefundApplicationPdf(model) {
  const ctx = await createDoc();
  const { person } = model;

  const s = makeSheet(ctx, {
    inn: person.inn,
    pageNo: 1,
    formTitle:
      "Заявление о распоряжении путём возврата суммы денежных средств, формирующих положительное сальдо единого налогового счёта",
    sheetTitle: "КНД 1112542",
  });

  s.fieldsRow([
    { label: "Представляется в налоговый орган (код)", value: person.ifns, count: 4 },
  ]);
  s.h2("Сведения о налогоплательщике");
  s.field("Фамилия", person.lastName, 30);
  s.field("Имя", person.firstName, 25);
  s.field("Отчество", person.middleName, 25);
  s.fieldsRow([
    {
      label: "Дата рождения",
      value: fmtDate(person.birthDate).replace(/\./g, ""),
      count: 8,
    },
  ]);
  s.text(
    `Документ: паспорт гражданина РФ (код 21), серия ${person.passport.series} № ${person.passport.number}, выдан ${fmtDate(person.passport.date)}`,
    { size: 8.5 }
  );

  s.h2("Прошу вернуть на счёт");
  s.line("", "Сумма к возврату, руб.", rub(model.refund));
  s.h2("Сведения о счёте");
  s.line("", "БИК банка", model.bank.bik, 9);
  s.line("", "Вид счёта (02 — текущий)", model.bank.kind, 2);
  s.line("", "Номер счёта", model.bank.account, 20);

  s.divider();
  drawSignature(s, ctx, person.fio);
  drawFooter(
    s,
    ctx,
    "Сформировано сервисом «Налог-сервис» по образцу формы КНД 1112542. Подаётся через Личный кабинет ФНС или лично."
  );

  return ctx.doc.save();
}
