import assert from "node:assert/strict";
import { test } from "node:test";
import { cashOnHandCents, type CashCount, type DatedRecord } from "./cash-on-hand";
import { dateFromKey } from "./months";

// Counted at 3,463.00 on Oct 7 at 15:00 local (22:00 UTC).
const count: CashCount = { cents: 346300, setAt: new Date("2026-10-07T22:00:00Z"), day: "2026-10-07" };
const before = new Date("2026-10-07T21:00:00Z");
const after = new Date("2026-10-07T23:00:00Z");

function record(date: string, amountCents: number, createdAt = after): DatedRecord {
  return { date: dateFromKey(date), createdAt, amountCents };
}

const none = { incomes: [], cashPurchases: [], savingsMovements: [], paidBills: [] };

test("money on hand starts at the counted amount", () => {
  assert.equal(cashOnHandCents({ count, today: "2026-10-07", ...none }), 346300);
});

test("income adds and cash purchases, bills, statements, and savings subtract after counting", () => {
  const cents = cashOnHandCents({
    count,
    today: "2026-10-09",
    ...none,
    incomes: [record("2026-10-08", 120000)],
    cashPurchases: [record("2026-10-08", 15000)],
    // 500 into savings, 200 back out.
    savingsMovements: [record("2026-10-09", 50000), record("2026-10-09", -20000)],
    paidBills: [{ paidAt: after, amountCents: 80000 }, { paidAt: before, amountCents: 99999 }],
  });
  assert.equal(cents, 346300 + 120000 - 15000 - 30000 - 80000);
});

test("records entered late for earlier days or before counting were already in the accounts", () => {
  const cents = cashOnHandCents({
    count,
    today: "2026-10-08",
    ...none,
    // Logged after counting, but for the day before: already out of the account.
    cashPurchases: [record("2026-10-06", 10000), record("2026-10-07", 2000, before), record("2026-10-07", 3000, after)],
  });
  assert.equal(cents, 346300 - 3000);
});

test("a record dated ahead counts once its day comes, even if entered before counting", () => {
  const rent = record("2026-10-10", 500000, before);
  assert.equal(cashOnHandCents({ count, today: "2026-10-09", ...none, cashPurchases: [rent] }), 346300);
  assert.equal(cashOnHandCents({ count, today: "2026-10-10", ...none, cashPurchases: [rent] }), 346300 - 500000);
});

test("money changed into this wallet's currency adds, and money changed out of it subtracts", () => {
  // Sold US$100 for $1,780: this (peso) wallet gains 1,780; a later exchange back takes 500.
  const cents = cashOnHandCents({ count, today: "2026-10-09", ...none, transfers: [record("2026-10-08", 178000), record("2026-10-09", -50000)] });
  assert.equal(cents, 346300 + 178000 - 50000);
});
