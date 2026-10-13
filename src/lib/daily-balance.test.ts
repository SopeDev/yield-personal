import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyNet, daysOff, goalProgress, incomePace, neededPerDay, projectedBalance, typicalDailySpending } from "./daily-balance";
import type { LedgerCategory, LedgerPurchase, MonthSpendingEntry } from "./ledger";
import { dateFromKey } from "./months";

const food = { id: "food", key: "food", name: null, sortOrder: 1, kind: "EVERYDAY" as const };
const car = { id: "car", key: "car", name: null, sortOrder: 2, kind: "EVERYDAY" as const };
const extras = { id: "extras", key: "extras", name: null, sortOrder: 3, kind: "OCCASIONAL" as const };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const uber = { id: "uber", name: "Uber", groupId: "rideshare" };

function entry(date: string, amountCents: number, { installmentNumber = 1, category = food }: { installmentNumber?: number; category?: LedgerCategory } = {}): MonthSpendingEntry {
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
  // Without a history start, the last 3 full months count, through yesterday: Jul 1 to Oct 4.
  assert.deepEqual(typicalDailySpending({ purchases, today: "2026-10-05" }), { days: 96, cents: 1552 });
  // Counting from October: 500 over the 4 finished days; September's partial records and extras are left out.
  assert.deepEqual(typicalDailySpending({ purchases, today: "2026-10-05", historyStart: "2026-10" }), { days: 4, cents: 12500 });
  // A purchase today waits until the day is over.
  const withToday = [...purchases, entry("2026-10-05", 800000).purchase];
  assert.deepEqual(typicalDailySpending({ purchases: withToday, today: "2026-10-05", historyStart: "2026-10" }), { days: 4, cents: 12500 });
  // On the first day of the history there is no finished day yet, so today counts.
  assert.deepEqual(typicalDailySpending({ purchases: [entry("2026-10-01", 30000).purchase], today: "2026-10-01", historyStart: "2026-10" }), { days: 1, cents: 30000 });
});

test("needed per day adds a typical day's spending to the month's bills", () => {
  const needed = neededPerDay({ month: "2026-10", today: "2026-10-05", toPayCents: 2508219, incomeCents: 793924, typicalDailyCents: 10000 });
  assert.equal(needed?.cents, 73493);
  // Income already covers the bills, but the coming days still cost something.
  assert.equal(neededPerDay({ month: "2026-10", today: "2026-10-05", toPayCents: 100000, incomeCents: 370000, typicalDailyCents: 15000 })?.cents, 5000);
});

test("typical daily spending can leave out the costs of working", () => {
  const purchases = [entry("2026-10-02", 20000).purchase, entry("2026-10-03", 50000, { category: car }).purchase];
  assert.deepEqual(typicalDailySpending({ purchases, today: "2026-10-05", historyStart: "2026-10", excludeCategoryIds: ["car"] }), { days: 4, cents: 5000 });
});

test("days off left at the recent pace, with gas spent only on days worked", () => {
  // October 10, after nine finished days worked: 14,780.48 gross and 3,819 in gas, so 1,217.94 net per day worked;
  // 276.98 a day to live.
  const october = {
    month: "2026-10" as const,
    today: "2026-10-10",
    historyStart: "2026-10" as const,
    purchases: [entry("2026-10-02", 381900, { category: car }).purchase, entry("2026-10-03", 249284).purchase],
    incomes: Array.from({ length: 9 }, (_, day) => ({ date: dateFromKey(`2026-10-0${day + 1}`), amountCents: day === 0 ? 164232 : 164227 })),
    workCategoryIds: ["car"],
    livingDailyCents: 27698,
    toPayCents: 2850504,
    incomeCents: 1478048,
  };
  // 22 days left: 16.27 days of work break even and 19.56 reach a 4,000 goal, rounded up to a tenth (16.3 and 19.6),
  // leaving 5.7 and 2.4 days off: never more than there are.
  const expected = {
    daysLeft: 22, freeDays: 22, workedToday: false, livingCents: 609356, livingTodayLeftCents: 27698,
    workDays: 9, netPerWorkDayCents: 121794, workDaysNeeded: 16.3, forGoalWorkDaysNeeded: 19.6, days: 5.7, forGoalDays: 2.4,
  };
  assert.deepEqual(daysOff({ ...october, goalCents: 400000 }), expected);
  // Gas bought this morning, before today's income is logged, waits until the day is over to touch the pace.
  const morningGas = [...october.purchases, entry("2026-10-10", 50000, { category: car }).purchase];
  assert.deepEqual(daysOff({ ...october, goalCents: 400000, purchases: morningGas }), expected);
  // A tiny shortfall still costs a tenth of a day, not a whole one: 1.99 days off reads 1.9, never 1 or 2.
  assert.equal(daysOff({ ...october, toPayCents: 1478048, livingDailyCents: 0 })?.days, 22);
  assert.equal(daysOff({ ...october, toPayCents: 1478048 + 1000, livingDailyCents: 0 })?.days, 21.9);
  // Far behind there are no days off; far ahead every day left is one.
  assert.equal(daysOff({ ...october, toPayCents: 5000000 })?.days, 0);
  assert.equal(daysOff({ ...october, toPayCents: 0, livingDailyCents: 0 })?.days, 22);
  // Nothing to go on outside the current month, before any income, or when working costs more than it earns.
  assert.equal(daysOff({ ...october, today: "2026-11-01" }), null);
  assert.equal(daysOff({ ...october, incomes: [] }), null);
  assert.equal(daysOff({ ...october, purchases: [entry("2026-10-02", 2000000, { category: car }).purchase] }), null);
});

test("early in a month, days off lean on last month's pace, from the history start on", () => {
  const purchases = [entry("2026-09-20", 500000, { category: car }).purchase, entry("2026-10-02", 100000, { category: car }).purchase, entry("2026-11-01", 10000, { category: car }).purchase];
  const incomes = [
    { date: dateFromKey("2026-09-20"), amountCents: 9000000 },
    { date: dateFromKey("2026-10-02"), amountCents: 200000 },
    { date: dateFromKey("2026-11-01"), amountCents: 30000 },
  ];
  const november = { month: "2026-11" as const, today: "2026-11-01", purchases, incomes, workCategoryIds: ["car"], livingDailyCents: 0, toPayCents: 0, incomeCents: 30000 };
  // November 1 is under way, so October's finished day sets the pace: 2,000 gross less 1,000 gas, not today's 200.
  assert.equal(daysOff({ ...november, historyStart: "2026-10" })?.netPerWorkDayCents, 100000);
  // Without a history start, September's day counts too.
  assert.equal(daysOff(november)?.workDays, 2);
});

test("the pace of income spreads income since the history start over every day, days off included", () => {
  const incomes = [
    { date: dateFromKey("2026-06-30"), amountCents: 999900 },
    { date: dateFromKey("2026-09-03"), amountCents: 60000 },
    { date: dateFromKey("2026-10-09"), amountCents: 40000 },
    { date: dateFromKey("2026-10-11"), amountCents: 999900 },
  ];
  // Jul 1 to Oct 9 (finished days) is 101 days; income before or after them is left out.
  assert.deepEqual(incomePace({ incomes, today: "2026-10-10" }), { days: 101, cents: 990 });
  // From a history start in September: 39 days.
  assert.deepEqual(incomePace({ incomes, today: "2026-10-10", historyStart: "2026-09" }), { days: 39, cents: 2564 });
  // Income logged today counts from tomorrow.
  assert.deepEqual(incomePace({ incomes: [...incomes, { date: dateFromKey("2026-10-10"), amountCents: 50000 }], today: "2026-10-10", historyStart: "2026-09" }), { days: 39, cents: 2564 });
});

test("the projected balance adds what's expected and each day left at the pace, less typical spending", () => {
  // 22 days left from Oct 10, nothing recorded today yet: 1,000 + 500 expected + all of today (30 in, 20 out) + 21 × (30 − 20).
  const october = { month: "2026-10" as const, today: "2026-10-10", balanceCents: 100000, expectedCents: 50000, paceDailyCents: 3000, typicalDailyCents: 2000 };
  assert.deepEqual(projectedBalance(october), { daysLeft: 22, daysAfterToday: 21, todayIncomeLeftCents: 3000, todaySpendingLeftCents: 2000, cents: 172000 });
  // Today's records count once: 12 earned and 5 spent so far (already in the balance) leave 18 and 15 of an average day.
  assert.deepEqual(projectedBalance({ ...october, balanceCents: 100700, todayIncomeCents: 1200, todaySpentCents: 500 }), {
    daysLeft: 22, daysAfterToday: 21, todayIncomeLeftCents: 1800, todaySpendingLeftCents: 1500, cents: 172000,
  });
  // A day past the average expects nothing more today, and never takes back what was earned.
  assert.equal(projectedBalance({ ...october, balanceCents: 104000, todayIncomeCents: 4000, todaySpentCents: 0 })?.todayIncomeLeftCents, 0);
  assert.equal(projectedBalance({ ...october, balanceCents: 104000, todayIncomeCents: 4000, todaySpentCents: 0 })?.cents, 104000 + 50000 - 2000 + 21 * 1000);
  // A month still to come counts all its days; one that has ended has nothing to project.
  assert.equal(projectedBalance({ month: "2026-11", today: "2026-10-10", balanceCents: 0, expectedCents: 0, paceDailyCents: 100, typicalDailyCents: 0 })?.cents, 3000);
  assert.equal(projectedBalance({ month: "2026-09", today: "2026-10-10", balanceCents: 0, expectedCents: 0, paceDailyCents: 0, typicalDailyCents: 0 }), null);
});

test("an average day reads the same at night, once logged, as the next morning", () => {
  // Nine finished days, then October 10: gas and food in the morning, an average day's income at night.
  const purchases = [
    entry("2026-10-02", 381900, { category: car }).purchase,
    entry("2026-10-03", 249284).purchase,
    entry("2026-10-10", 42433, { category: car }).purchase,
    entry("2026-10-10", 27698).purchase,
  ];
  const incomes = [
    ...Array.from({ length: 9 }, (_, day) => ({ date: dateFromKey(`2026-10-0${day + 1}`), amountCents: day === 0 ? 164232 : 164227 })),
    { date: dateFromKey("2026-10-10"), amountCents: 164228 },
  ];
  // The month's figures hold every record either way; only what counts as today changes.
  const month = { month: "2026-10" as const, historyStart: "2026-10" as const, purchases, incomes, workCategoryIds: ["car"], toPayCents: 2850504 + 42433 + 27698, incomeCents: 1478048 + 164228, goalCents: 400000 };
  const at = (today: string) => daysOff({
    ...month, today, livingDailyCents: typicalDailySpending({ purchases, today, historyStart: "2026-10", excludeCategoryIds: ["car"] }).cents,
  });
  const night = at("2026-10-10");
  const morning = at("2026-10-11");
  // At night today is a day worked: 21 days are still free, as they are the next morning.
  assert.equal(night?.freeDays, 21);
  assert.equal(morning?.freeDays, 21);
  assert.ok(Math.abs((night?.forGoalDays ?? 0) - (morning?.forGoalDays ?? 0)) <= 0.1, `${night?.forGoalDays} at night, ${morning?.forGoalDays} the next morning`);
  assert.ok(Math.abs((night?.days ?? 0) - (morning?.days ?? 0)) <= 0.1, `${night?.days} at night, ${morning?.days} the next morning`);
});
