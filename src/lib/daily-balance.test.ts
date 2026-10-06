import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyNet, goalProgress, neededPerDay, typicalDailySpending } from "./daily-balance";
import type { LedgerPurchase, MonthSpendingEntry } from "./ledger";
import { dateFromKey } from "./months";

const food = { id: "food", key: "food", name: null, sortOrder: 1, includeInAverage: true };
const extras = { id: "extras", key: "extras", name: null, sortOrder: 3, includeInAverage: false };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const uber = { id: "uber", name: "Uber", isRideshare: true };

function entry(date: string, amountCents: number, { installmentNumber = 1, category = food } = {}): MonthSpendingEntry {
  const purchase: LedgerPurchase = { id: date, date: dateFromKey(date), amountCents, note: null, installmentCount: installmentNumber, item: { id: "comida", name: "Comida", category }, paymentMethod: cash };
  return { purchase, amountCents, installmentNumber };
}

const month = {
  month: "2026-10" as const,
  entries: [
    entry("2026-10-02", 20000),
    entry("2026-10-12", 50000),
    entry("2026-10-03", 900000, { category: extras }),
    entry("2026-08-15", 10000, { installmentNumber: 3 }),
  ],
  incomes: [
    { id: "1", date: dateFromKey("2026-10-01"), amountCents: 150000, note: null, source: uber },
    { id: "2", date: dateFromKey("2026-10-11"), amountCents: 90000, note: null, source: uber },
  ],
};

test("a typical day's net leaves out extras and installments of earlier purchases", () => {
  // By the 10th: 1,500 income − 200 food, over 10 days.
  assert.deepEqual(dailyNet({ ...month, today: "2026-10-10" }), { days: 10, incomeCents: 150000, spendingCents: 20000, averageCents: 13000 });
  // A past month counts all of its days.
  assert.deepEqual(dailyNet({ ...month, today: "2026-11-05" }), { days: 31, incomeCents: 240000, spendingCents: 70000, averageCents: 5484 });
  assert.equal(dailyNet({ ...month, today: "2026-09-30" }), null);
});

test("income needed per remaining day to cover the month's total to pay", () => {
  // Oct 5: 27 days left, today included.
  assert.deepEqual(neededPerDay({ month: "2026-10", today: "2026-10-05", toPayCents: 2508219, incomeCents: 793924 }), { daysLeft: 27, typicalDailyCents: 0, cents: 63493, forGoalCents: null });
  assert.equal(neededPerDay({ month: "2026-10", today: "2026-10-31", toPayCents: 100000, incomeCents: 150000 })?.cents, 0);
  assert.deepEqual(neededPerDay({ month: "2026-11", today: "2026-10-05", toPayCents: 300000, incomeCents: 0 }), { daysLeft: 30, typicalDailyCents: 0, cents: 10000, forGoalCents: null });
  assert.equal(neededPerDay({ month: "2026-09", today: "2026-10-05", toPayCents: 300000, incomeCents: 0 }), null);
});

test("the balance goal raises what's needed per day, with savings counting toward it", () => {
  const october = { month: "2026-10" as const, today: "2026-10-05", toPayCents: 2508219, incomeCents: 793924, goalCents: 500000 };
  // (17,142.95 + 5,000) over 27 days.
  assert.equal(neededPerDay(october)?.forGoalCents, 82011);
  // 2,000 of to pay went into savings: 2,000 less is needed for the goal, the same for breaking even.
  const saved = neededPerDay({ ...october, savingsNetCents: 200000 });
  assert.equal(saved?.cents, 63493);
  assert.equal(saved?.forGoalCents, 74604);
  assert.equal(neededPerDay({ ...october, incomeCents: 3100000 })?.forGoalCents, 0);
  assert.equal(goalProgress({ balanceCents: -200000, savingsNetCents: 500000 }), 300000);
});

test("typical daily spending pools everyday purchases since the history start", () => {
  const purchases = [
    entry("2026-09-20", 99000).purchase,
    entry("2026-10-02", 20000).purchase,
    entry("2026-10-03", 900000, { category: extras }).purchase,
    entry("2026-10-04", 30000).purchase,
  ];
  // Without a history start, the last 3 full months count: Jul 1 to Oct 5.
  assert.deepEqual(typicalDailySpending({ purchases, today: "2026-10-05" }), { days: 97, cents: 1536 });
  // Counting from October: 500 over 5 days; September's partial records and extras are left out.
  assert.deepEqual(typicalDailySpending({ purchases, today: "2026-10-05", historyStart: "2026-10" }), { days: 5, cents: 10000 });
});

test("needed per day adds a typical day's spending to the month's bills", () => {
  const needed = neededPerDay({ month: "2026-10", today: "2026-10-05", toPayCents: 2508219, incomeCents: 793924, typicalDailyCents: 10000 });
  assert.equal(needed?.cents, 73493);
  // Income already covers the bills, but the coming days still cost something.
  assert.equal(neededPerDay({ month: "2026-10", today: "2026-10-05", toPayCents: 100000, incomeCents: 370000, typicalDailyCents: 15000 })?.cents, 5000);
});
