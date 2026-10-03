import assert from "node:assert/strict";
import { test } from "node:test";
import { consumptionInMonth, splitInstallments } from "./installments";
import { dateFromKey } from "./months";

test("splits installments and keeps every centavo", () => {
  assert.deepEqual(splitInstallments(66600, 2), [33300, 33300]);
  assert.deepEqual(splitInstallments(100, 3), [34, 33, 33]);
});

test("counts a single payment only in its purchase month", () => {
  const purchase = { date: dateFromKey("2026-10-05"), amountCents: 41000, installmentCount: 1 };
  assert.deepEqual(consumptionInMonth(purchase, "2026-10"), { amountCents: 41000, installmentNumber: 1 });
  assert.equal(consumptionInMonth(purchase, "2026-11"), null);
});

test("spreads installment purchases across consecutive months", () => {
  const purchase = { date: dateFromKey("2026-10-20"), amountCents: 66600, installmentCount: 2 };
  assert.equal(consumptionInMonth(purchase, "2026-09"), null);
  assert.deepEqual(consumptionInMonth(purchase, "2026-10"), { amountCents: 33300, installmentNumber: 1 });
  assert.deepEqual(consumptionInMonth(purchase, "2026-11"), { amountCents: 33300, installmentNumber: 2 });
  assert.equal(consumptionInMonth(purchase, "2026-12"), null);
});
