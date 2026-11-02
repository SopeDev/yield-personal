import assert from "node:assert/strict";
import { test } from "node:test";
import { inMainCurrency } from "./currency-merge";
import { summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, kind: "BILLS" as const };
const food = { id: "food", key: "food", name: null, sortOrder: 1, kind: "EVERYDAY" as const };
const pesos = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#000", currency: "MXN" };
const dollars = { id: "usd", kind: "CASH" as const, name: "Dólares", color: "#000", currency: "USD" };

test("records in other currencies count in the month's figures at the rate given, and a currency with none stays out", () => {
  const data: LedgerData = {
    categories: [fixed, food],
    purchases: [{ id: "p1", date: dateFromKey("2026-11-03"), amountCents: 20000, note: null, installmentCount: 1, item: { id: "tacos", name: "Tacos", category: food }, paymentMethod: pesos }],
    incomes: [{ id: "i1", date: dateFromKey("2026-11-02"), amountCents: 100000, note: null, source: { id: "didi", name: "Didi", groupId: null }, currency: "MXN" }],
    incomeGroups: [],
    definitions: [{
      id: "rent", item: { id: "renta", name: "Renta", category: fixed }, amountCents: 65000, isVariable: false, intervalMonths: 1, dayOfMonth: 1,
      startMonth: dateFromKey("2026-11-01"), endMonth: null, paymentMethod: dollars,
    }],
    overrides: [{ recurringPaymentId: "rent", month: dateFromKey("2026-11-01"), amountCents: null, paidAt: new Date("2026-11-01T18:00:00Z") }],
    recurringHistory: [], statements: [], savingsMovements: [],
  };
  // US$650 of rent at $17.30 a dollar: $11,245 of Fijos in November, paid.
  const merged = inMainCurrency(data, "MXN", new Map([["USD", { rate: 17.3, date: "2026-11-01", own: true as const }]]));
  const month = summarizeMonth(merged, "2026-11");
  assert.equal(month.cashFlow.cashBillsCents, 1124500);
  assert.equal(month.cashFlow.toPayCents, 20000 + 1124500);
  assert.equal(month.balanceCents, 100000 - 20000 - 1124500);
  assert.equal(month.cashFlow.outstandingCents, 0);
  // Without a rate the rent stays out of the figures.
  assert.equal(summarizeMonth(inMainCurrency(data, "MXN", new Map()), "2026-11").cashFlow.toPayCents, 20000);
});
