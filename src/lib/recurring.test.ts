import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey, dateKeyOf } from "./months";
import { isActiveInMonth, occurrencesForMonth, type RecurringDefinition } from "./recurring";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };

const rent: RecurringDefinition = {
  id: "rent", name: "Renta", amountCents: 800000, dayOfMonth: 31,
  startMonth: dateFromKey("2026-10-01"), endMonth: null, category: fixed, paymentMethod: cash,
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
