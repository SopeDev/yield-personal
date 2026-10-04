import assert from "node:assert/strict";
import { test } from "node:test";
import { monthCashFlow, occurrencePaymentStatus, recurringChargeId } from "./cash-flow";
import type { LedgerPurchase } from "./ledger";
import { dateFromKey } from "./months";
import { occurrencesForMonth, type RecurringDefinition } from "./recurring";
import { buildStatements } from "./statements";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const car = { id: "car", key: "car", name: null, sortOrder: 2, includeInAverage: true };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const nu = { id: "nu", kind: "CARD" as const, name: "Nu", color: "#8b5cf6" };
const nuCycle = { id: "nu", closingDay: 5, paymentDays: 20 };

const definitions: RecurringDefinition[] = [
  { id: "rent", item: { id: "rent", name: "Renta", category: fixed }, amountCents: 800000, dayOfMonth: 1, startMonth: dateFromKey("2026-10-01"), endMonth: null, paymentMethod: cash },
  { id: "netflix", item: { id: "netflix", name: "Netflix", category: fixed }, amountCents: 21900, dayOfMonth: 3, startMonth: dateFromKey("2026-10-01"), endMonth: null, paymentMethod: nu },
];

const purchases: LedgerPurchase[] = [
  { id: "gas", date: dateFromKey("2026-10-02"), amountCents: 41000, note: null, installmentCount: 1, item: { id: "gasolina", name: "Gasolina", category: car }, paymentMethod: cash },
  { id: "tires", date: dateFromKey("2026-10-04"), amountCents: 300000, note: null, installmentCount: 1, item: { id: "llantas", name: "Llantas", category: car }, paymentMethod: nu },
];

test("cash spending, cash bills, and statements due make up the month's total to pay", () => {
  const occurrences = occurrencesForMonth(definitions, [], "2026-10");
  const netflix = occurrences.find((occurrence) => occurrence.recurring.id === "netflix")!;
  const statements = buildStatements(
    nuCycle,
    purchases.filter((purchase) => purchase.paymentMethod.kind === "CARD").map((purchase) => ({ ...purchase, description: purchase.item.name })),
    [{ id: recurringChargeId(netflix), description: "Netflix", date: netflix.date, amountCents: netflix.amountCents }],
    new Set(),
  );

  const flow = monthCashFlow({ month: "2026-10", purchases, occurrences, statements });
  // Gas 410 + rent 8,000 + Nu statement closing Oct 5, due Oct 25 (tires 3,000 + Netflix 219).
  assert.equal(flow.toPayCents, 41000 + 800000 + 321900);
  assert.equal(flow.outstandingCents, 800000 + 321900);

  assert.deepEqual(occurrencePaymentStatus(netflix, statements).paid, false);
  const paidStatements = statements.map((statement) => ({ ...statement, paid: true }));
  assert.equal(occurrencePaymentStatus(netflix, paidStatements).paid, true);
  assert.equal(monthCashFlow({ month: "2026-10", purchases, occurrences, statements: paidStatements }).outstandingCents, 800000);
});
