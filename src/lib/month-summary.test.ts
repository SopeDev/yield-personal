import assert from "node:assert/strict";
import { test } from "node:test";
import { statementsForCards } from "./card-statements";
import type { LedgerPurchase } from "./ledger";
import { summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";
import type { RecurringDefinition } from "./recurring";
import { installmentsOwed } from "./statements";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const food = { id: "food", key: "food", name: null, sortOrder: 1, includeInAverage: true };
const car = { id: "car", key: "car", name: null, sortOrder: 2, includeInAverage: true };
const extras = { id: "extras", key: "extras", name: null, sortOrder: 3, includeInAverage: false };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const klar = { id: "klar", kind: "CARD" as const, name: "Klar", color: "#14b8a6" };
const klarCard = { id: "klar", closingDay: 20, dueDay: 20 };

const definitions: RecurringDefinition[] = [
  { id: "rent", item: { id: "rent", name: "Renta", category: fixed }, amountCents: 800000, dayOfMonth: 1, startMonth: dateFromKey("2026-10-01"), endMonth: null, paymentMethod: cash },
];

function purchase(id: string, date: string, amountCents: number, category: LedgerPurchase["item"]["category"], paymentMethod: LedgerPurchase["paymentMethod"], installmentCount = 1): LedgerPurchase {
  return { id, date: dateFromKey(date), amountCents, note: null, installmentCount, item: { id, name: id, category }, paymentMethod };
}

const purchases = [
  purchase("gas", "2026-10-02", 41000, car, cash),
  purchase("pho", "2026-10-04", 26000, food, cash),
  purchase("escritorio", "2026-10-10", 66600, extras, klar, 2),
];

test("summarizes spending, cash out, savings, and balance for a month", () => {
  const statements = statementsForCards({
    cards: [klarCard], purchases: purchases.filter((item) => item.paymentMethod.kind === "CARD"),
    definitions, overrides: [], recurringFrom: "2026-09", recurringTo: "2026-12", paidStatements: [],
  });
  const data: LedgerData = {
    categories: [fixed, food, car, extras],
    purchases,
    incomes: [{ id: "uber", date: dateFromKey("2026-10-01"), amountCents: 326940, note: null, source: { id: "uber", name: "Uber", isRideshare: true } }],
    definitions,
    overrides: [],
    statements,
    savingsMovements: [{ id: "s", fundId: "emergency", date: dateFromKey("2026-10-20"), amountCents: 100000, note: null }],
  };

  const october = summarizeMonth(data, "2026-10");
  // Spending: rent 8,000 + food 260 + car 410 + first desk installment 333.
  assert.equal(october.spending.totalCents, 800000 + 26000 + 41000 + 33300);
  // Cash out: rent, gas, pho, and 1,000 into savings. The Klar statement closing Oct 20 is due Nov 20.
  assert.equal(october.cashFlow.toPayCents, 800000 + 41000 + 26000 + 100000);
  assert.equal(october.savingsNetCents, 100000);
  assert.equal(october.balanceCents, 326940 - october.cashFlow.toPayCents);
  assert.equal(october.income.netRideshareCents, 326940 - 41000);

  const november = summarizeMonth(data, "2026-11");
  assert.equal(november.cashFlow.statementsDue.length, 1);
  assert.equal(november.cashFlow.statementsDue[0].totalCents, 33300);
  assert.equal(installmentsOwed(statements), 66600);
});
