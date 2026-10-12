import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/messages/en.json";
import es from "../i18n/messages/es.json";
import { dueReminder, duePayments, type DuePayment } from "./due-soon";
import { dateFromKey } from "./months";
import type { RecurringOccurrence } from "./recurring";
import type { Statement } from "./statements";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, kind: "BILLS" as const };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const nu = { id: "nu", kind: "CARD" as const, name: "Nu", color: "#820ad1" };

function bill(name: string, date: string, amountCents: number, { paid = false, method = cash }: { paid?: boolean; method?: typeof cash | typeof nu } = {}) {
  return {
    recurring: { id: name, item: { id: name, name, category: fixed }, paymentMethod: method },
    month: date.slice(0, 7),
    date: dateFromKey(date),
    chargeDate: dateFromKey(date),
    amountCents,
    amountChanged: false,
    cashPaidAt: paid ? dateFromKey(date) : null,
  } as unknown as RecurringOccurrence;
}

function statement(month: string, dueDate: string, totalCents: number, paid = false): Statement {
  return { paymentMethodId: "nu", month: month as Statement["month"], closingDate: dateFromKey(`${month}-05`), dueDate: dateFromKey(dueDate), dueMonth: dueDate.slice(0, 7) as Statement["month"], totalCents, charges: [], paid };
}

test("unpaid cash bills and card statements due in the next 3 days, overdue ones first", () => {
  const payments = duePayments({
    today: "2026-10-18",
    occurrences: [
      bill("Renta", "2026-10-01", 1190000, { paid: true }),
      bill("Luz", "2026-10-15", 60000),
      bill("Seguro", "2026-10-20", 100000),
      bill("Gym", "2026-10-21", 75000),
      bill("Internet", "2026-10-22", 50000),
      // Paid through its card statement, so it's never reminded on its own.
      bill("Netflix", "2026-10-19", 29900, { method: nu }),
    ],
    statements: [statement("2026-10", "2026-10-20", 341546), statement("2026-09", "2026-09-20", 200000, true), statement("2026-11", "2026-11-20", 99000)],
    cardNames: new Map([["nu", "Nu"]]),
  });
  assert.deepEqual(payments.map((payment) => [payment.name, payment.dueOn, payment.daysLeft]), [
    ["Luz", "2026-10-15", -3],
    ["Nu", "2026-10-20", 2],
    ["Seguro", "2026-10-20", 2],
    ["Gym", "2026-10-21", 3],
  ]);
});

test("the reminder names a single payment, or counts several with a line each", () => {
  const payment = (name: string, amountCents: number, daysLeft: number, currency?: string): DuePayment => ({ name, amountCents, currency, dueOn: "", daysLeft });
  assert.deepEqual(dueReminder([payment("Renta", 1190000, 1)], { messages: en, mainCurrency: "MXN" }), {
    title: "Renta, due tomorrow",
    body: "Renta · $11,900.00 · due tomorrow",
  });
  const many = dueReminder([payment("Luz", 60000, -2), payment("Nu", 341546, 0), payment("Hosting", 2000, 3, "USD")], { messages: en, mainCurrency: "MXN" });
  assert.equal(many.title, "3 payments due soon");
  assert.deepEqual(many.body.split("\n"), ["Luz · $600.00 · 2 days overdue", "Nu · $3,415.46 · due today", "Hosting · US$20.00 · due in 3 days"]);
  assert.equal(dueReminder([payment("Luz", 60000, -1)], { messages: es, mainCurrency: "MXN" }).title, "Luz, vencido hace 1 día");
});
