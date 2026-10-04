import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey, dateKeyOf } from "./months";
import { estimateFromHistory, isActiveInMonth, nextActiveMonth, occurrencesForMonth, unpaidCashOccurrences, type RecurringDefinition } from "./recurring";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };

const rent: RecurringDefinition = {
  id: "rent", item: { id: "rent", name: "Renta", category: fixed }, amountCents: 800000, isVariable: false, intervalMonths: 1, dayOfMonth: 31,
  startMonth: dateFromKey("2026-10-01"), endMonth: null, paymentMethod: cash,
};

test("recurring payments run from their start month through their end month", () => {
  assert.ok(!isActiveInMonth(rent, "2026-09"));
  assert.ok(isActiveInMonth(rent, "2027-05"));
  assert.ok(!isActiveInMonth({ ...rent, endMonth: dateFromKey("2026-12-01") }, "2027-01"));
});

test("occurrences use the default amount unless that month was changed", () => {
  const overrides = [{ recurringPaymentId: "rent", month: dateFromKey("2026-10-01"), amountCents: 1190000, paidAt: dateFromKey("2026-10-02") }];
  const october = occurrencesForMonth([rent], overrides, "2026-10")[0];
  assert.equal(october.amountCents, 1190000);
  assert.ok(october.amountChanged);
  assert.ok(october.cashPaidAt);

  const november = occurrencesForMonth([rent], overrides, "2026-11")[0];
  assert.equal(november.amountCents, 800000);
  assert.equal(november.cashPaidAt, null);
  assert.equal(dateKeyOf(november.date), "2026-11-30");
});

test("bills every N months fall only on their cycle from the start month", () => {
  const luz = { ...rent, id: "luz", intervalMonths: 2, startMonth: dateFromKey("2026-09-01") };
  assert.deepEqual(
    ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"].map((month) => isActiveInMonth(luz, month as `${number}-${number}`)),
    [false, true, false, true, false, true],
  );
  assert.equal(nextActiveMonth(luz, "2026-10"), "2026-11");
  assert.equal(nextActiveMonth(luz, "2026-11"), "2026-11");
  assert.equal(nextActiveMonth({ ...luz, endMonth: dateFromKey("2026-10-01") }, "2026-10"), null);
});

test("variable bills are estimated from recent confirmed amounts until confirmed", () => {
  const luz: RecurringDefinition = { ...rent, id: "luz", item: { id: "luz", name: "Luz", category: fixed }, amountCents: 60000, isVariable: true };

  // No history yet: the usual amount is the estimate.
  const first = occurrencesForMonth([luz], [], "2026-10")[0];
  assert.equal(first.amountCents, 60000);
  assert.ok(first.estimated);

  // History from any recurring payment of the same item, last three months only.
  const history = [
    { itemId: "luz", month: dateFromKey("2026-06-01"), amountCents: 10000 },
    { itemId: "luz", month: dateFromKey("2026-07-01"), amountCents: 70000 },
    { itemId: "luz", month: dateFromKey("2026-08-01"), amountCents: 74000 },
    { itemId: "luz", month: dateFromKey("2026-09-01"), amountCents: 80000 },
    { itemId: "agua", month: dateFromKey("2026-09-01"), amountCents: 99999 },
  ];
  assert.equal(estimateFromHistory(history, "luz", "2026-10"), 74667);
  const estimated = occurrencesForMonth([luz], [], "2026-10", history)[0];
  assert.equal(estimated.amountCents, 74667);
  assert.ok(estimated.estimated);

  // Confirming the month's amount replaces the estimate.
  const confirmed = occurrencesForMonth([luz], [{ recurringPaymentId: "luz", month: dateFromKey("2026-10-01"), amountCents: 81200, paidAt: null }], "2026-10", history)[0];
  assert.equal(confirmed.amountCents, 81200);
  assert.ok(!confirmed.estimated);
  assert.ok(!confirmed.amountChanged);
});

test("unpaid cash bills from earlier months are carried, skipping paid months and months before the bill was added", () => {
  const card = { id: "nu", kind: "CARD" as const, name: "Nu", color: "#8b5cf6" };
  const gym: RecurringDefinition = { ...rent, id: "gym", item: { id: "gym", name: "Gym", category: fixed }, startMonth: dateFromKey("2026-07-01"), addedMonth: "2026-08" };
  const netflix: RecurringDefinition = { ...rent, id: "netflix", item: { id: "netflix", name: "Netflix", category: fixed }, paymentMethod: card };
  const overrides = [{ recurringPaymentId: "rent", month: dateFromKey("2026-11-01"), amountCents: null, paidAt: dateFromKey("2026-11-01") }];

  const carried = unpaidCashOccurrences([rent, gym, netflix], overrides, "2026-06", "2027-01");
  assert.deepEqual(carried.map((occurrence) => `${occurrence.recurring.id} ${occurrence.month}`), [
    "gym 2026-08", "gym 2026-09", "gym 2026-10", "rent 2026-10", "gym 2026-11", "gym 2026-12", "rent 2026-12",
  ]);
});
