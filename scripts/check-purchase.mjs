#!/usr/bin/env node
// Доступ к оплаченному: переживает ли он релизы.
//
//   npm run check:purchase
//
// Зачем. Оплата привязана к содержанию анкеты хешем. Каждый релиз, добавляющий
// поле, дописывает его всем сохранённым черновикам (withDefaults) — и если
// пустое поле влияет на хеш, у человека, оплатившего ДО релиза, доступ
// пропадает сам собой: «анкета изменилась после оплаты, оплатите новую
// декларацию». Он не делал ничего. Именно это случилось 10.09.2026 с полями
// standard / savings / socialProvided.
//
// Проверяем обе стороны, и вторая не менее важна первой: доступ обязан
// переживать релиз и смену алгоритма хеширования — и обязан ПРОПАДАТЬ, когда
// человек действительно правит данные, иначе документы выдаются бесплатно.
import { computeDraftHash, draftSnapshot, findPurchase } from "../src/lib/draftHash.js";
import { DRAFT_KEY, mergeStored, restoreFromSnapshot } from "../src/lib/draftStore.js";

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  const got = actual ? "доступ есть" : "просит оплатить";
  const want = expected ? "доступ есть" : "просит оплатить";
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(38)} ${got}${ok ? "" : ` — ожидали «${want}»`}`);
};

const paidDraft = {
  v: 2, step: 6, year: 2025, correction: 0, types: ["lechenie"],
  personal: { lastName: "Иванов", firstName: "Пётр", inn: "500100732259", phone: "+79120000000" },
  incomes: [{ name: "ООО", inn: "7420010847", kpp: "741501001", oktmo: "75701000",
              income: "1200000", withheld: "156000" }],
  medical: { ordinary: "60000", expensive: "" },
  education: { self: "", children: [] },
  iis: {}, insurance: {}, sport: { amount: "" },
  property: {}, bank: { bik: "047501711", account: "40702810007710002545" },
  sales: [], order: null, purchases: [],
};

const hash = await computeDraftHash(paidDraft);
const purchase = { id: "ord-1", provider: "yookassa", amount: 199,
                   draftHash: hash, snapshot: draftSnapshot(paidDraft) };
paidDraft.purchases = [purchase];
const open = async (d) => Boolean(findPurchase(d, await computeDraftHash(d)));

check("сразу после оплаты", await open(paidDraft), true);

// Релиз: withDefaults дописывает поля, которых в черновике не было. Плюс поле,
// о котором мы сегодня не знаем, — проверка должна держать и такое.
const afterRelease = {
  ...paidDraft,
  standard: { children: [], singleParent: false, providedByAgent: "", months: "", monthly: [] },
  savings: { contracts: [], byAgent: "", simplified: "" },
  socialProvided: { byAgent: "", simplified: "" },
  полеИзБудущего: { foo: "", bar: [], baz: 0 },
};
check("после релиза с новыми полями", await open(afterRelease), true);
if ((await computeDraftHash(afterRelease)) !== hash) {
  failures++;
  console.log("✗ хеш изменился от одного лишь релиза — пустые поля попадают в хеш");
}

// Покупка, сделанная прежней версией сайта: хеш чужой, снимок на месте.
check("покупка прежней версии сайта",
  Boolean(findPurchase({ ...afterRelease,
    purchases: [{ ...purchase, draftHash: "хеш-другого-алгоритма" }] },
    await computeDraftHash(afterRelease))), true);

// Настоящие правки доступ давать НЕ должны.
check("изменил фамилию",
  await open({ ...afterRelease, personal: { ...afterRelease.personal, lastName: "Иванова" } }), false);
check("изменил сумму лечения",
  await open({ ...afterRelease, medical: { ordinary: "70000", expensive: "" } }), false);
check("изменил год декларации",
  await open({ ...afterRelease, year: 2024 }), false);
check("добавил ещё один вычет",
  await open({ ...afterRelease, types: ["lechenie", "sport"], sport: { amount: "30000" } }), false);
check("добавил ребёнка",
  await open({ ...afterRelease, types: ["lechenie", "deti"],
               standard: { ...afterRelease.standard, children: [{ order: "1" }] } }), false);

// Возврат прежних данных обязан вернуть доступ.
check("вернул данные обратно", await open(afterRelease), true);
// Порядок выбора вычетов не содержателен.
check("переставил вычеты местами",
  await open({ ...afterRelease, types: ["lechenie"] }), true);

// --- Вторая вкладка не должна стирать оплату ---------------------------
// Черновик один на все вкладки. Вкладка, узнавшая об оплате позже, писала
// себя поверх — и оплата, подтверждённая в соседней вкладке, исчезала.
const fake = (obj) => ({ getItem: () => (obj === null ? null : JSON.stringify(obj)) });
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(38)} ${ok ? "" : `получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`);
};

const buy = (id) => ({ id, provider: "yookassa", amount: 199 });
const waiting = { id: "ord-w", provider: "yookassa", status: "waiting", confirmationUrl: "u" };

eq("оплата из соседней вкладки цела",
  mergeStored({ purchases: [] }, fake({ purchases: [buy("ord-A")] })).purchases.map((p) => p.id),
  ["ord-A"]);
eq("две вкладки — обе оплаты целы",
  mergeStored({ purchases: [buy("ord-B")] }, fake({ purchases: [buy("ord-A")] })).purchases.map((p) => p.id),
  ["ord-B", "ord-A"]);
eq("повтор не задваивается",
  mergeStored({ purchases: [buy("ord-A")] }, fake({ purchases: [buy("ord-A")] })).purchases.length, 1);
eq("«Начать заново» не теряет неподтверждённый заказ",
  mergeStored({ purchases: [], order: null }, fake({ order: waiting })).order?.id, "ord-w");
eq("подтверждённый заказ не воскресает",
  mergeStored({ purchases: [buy("ord-w")], order: null }, fake({ order: waiting })).order, null);
eq("пустое хранилище ничего не ломает",
  mergeStored({ purchases: [buy("ord-A")], order: null }, fake(null)).purchases.length, 1);
eq("битое хранилище ничего не ломает",
  mergeStored({ purchases: [buy("ord-A")] }, { getItem: () => "{не json" }).purchases.length, 1);
if (DRAFT_KEY !== "ns.decl.draft.v1") { failures++; console.log("✗ ключ черновика поменялся — старые черновики потеряются"); }

// --- Кнопка «вернуть оплаченные данные» обязана возвращать доступ ---------
// Иначе она хуже, чем ничего: человек нажимает и всё равно видит «оплатите».
{
  const edited = { ...afterRelease, personal: { ...afterRelease.personal, lastName: "Иванова" } };
  const back = restoreFromSnapshot(purchase.snapshot, { ...afterRelease, purchases: [] });
  check("вернул оплаченные данные кнопкой",
    await open({ ...back, purchases: edited.purchases }), true);
  // И пустые поля обязаны вернуться пустыми, а не пропасть: иначе поля формы
  // становятся неуправляемыми и шаг падает на рендере.
  const holes = [];
  const walk = (t, v, path) => {
    if (t && typeof t === "object" && !Array.isArray(t)) {
      for (const k of Object.keys(t)) {
        if (!(k in (v || {}))) holes.push(`${path}.${k}`);
        else walk(t[k], v[k], `${path}.${k}`);
      }
    }
  };
  walk(afterRelease, back, "черновик");
  if (holes.length) {
    failures++;
    console.log(`✗ после возврата пропали поля: ${holes.slice(0, 5).join(", ")}`);
  } else {
    console.log("✓ после возврата на месте все поля анкеты");
  }
}

console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nДоступ к оплаченному ведёт себя правильно.");
process.exit(failures ? 1 : 0);
