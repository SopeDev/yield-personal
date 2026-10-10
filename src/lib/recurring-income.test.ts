import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey } from "./months";
import { expectedIncomeLeft, expectedPaydays, recurringIncomeRhythmOf, recurringIncomeStart, type RecurringIncomeDefinition } from "./recurring-income";

const salary: RecurringIncomeDefinition = {
  id: "salary", source: { id: "work", name: "Salary", groupId: null }, amountCents: 1500000, rhythm: { kind: "MONTH_DAYS", days: [15, 30] }, startsOn: "2026-09-01",
};
const rent: RecurringIncomeDefinition = {
  id: "rent", source: { id: "flat", name: "Rent", groupId: null }, amountCents: 500000, rhythm: { kind: "BIWEEKLY", anchor: "2026-10-02" }, startsOn: "2026-10-10",
};

test("each recurring income's paydays are expected from its start, until income is received for them", () => {
  const received = { id: "i1", date: dateFromKey("2026-10-16"), amountCents: 1480000, recurringIncomeId: "salary", expectedOn: dateFromKey("2026-10-15") };
  const paydays = expectedPaydays([salary, rent], [received], "2026-10");
  // Rent's Oct 2 payday came before it was tracked; the rest are in date order.
  assert.deepEqual(paydays.map((payday) => [payday.recurring.id, payday.date, payday.received?.id ?? null]), [
    ["salary", "2026-10-15", "i1"],
    ["rent", "2026-10-16", null],
    ["rent", "2026-10-30", null],
    ["salary", "2026-10-30", null],
  ]);
  assert.deepEqual(expectedIncomeLeft(paydays), { cents: 2500000, paydaysLeft: 3, paydays: 4 });
  // Other income, or income received for another payday, doesn't count.
  assert.equal(expectedPaydays([salary], [{ ...received, recurringIncomeId: null }], "2026-10")[0].received, null);
  assert.equal(expectedPaydays([salary], [received], "2026-11")[0].received, null);
});

test("a recurring income starts counting today, or on a first weekly payday still to come", () => {
  assert.equal(recurringIncomeStart({ kind: "MONTH_DAYS", days: [1] }, "2026-10-10"), "2026-10-10");
  assert.equal(recurringIncomeStart({ kind: "WEEKLY", anchor: "2026-09-04" }, "2026-10-10"), "2026-10-10");
  assert.equal(recurringIncomeStart({ kind: "BIWEEKLY", anchor: "2026-11-06" }, "2026-10-10"), "2026-11-06");
});

test("a recurring income is never daily", () => {
  assert.equal(recurringIncomeRhythmOf({ kind: "DAILY", anchor: null, days: [] }), null);
  assert.equal(recurringIncomeRhythmOf({ kind: "WEEKLY", anchor: null, days: [] }), null);
  assert.deepEqual(recurringIncomeRhythmOf({ kind: "MONTH_DAYS", anchor: null, days: [1] }), { kind: "MONTH_DAYS", days: [1] });
});
