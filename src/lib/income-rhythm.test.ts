import assert from "node:assert/strict";
import { test } from "node:test";
import { incomePerPayday, incomeRhythmOf, neededPerPayday, parsePayDays, paydaysInMonth } from "./income-rhythm";

test("paydays follow the rhythm, counting weekly ones from any payday", () => {
  assert.equal(paydaysInMonth({ kind: "DAILY" }, "2026-02").length, 28);
  // Fridays in October 2026, counted from a Friday in another month.
  assert.deepEqual(paydaysInMonth({ kind: "WEEKLY", anchor: "2026-12-04" }, "2026-10"), ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
  assert.deepEqual(paydaysInMonth({ kind: "BIWEEKLY", anchor: "2026-09-25" }, "2026-10"), ["2026-10-09", "2026-10-23"]);
  // A day past the month's end falls on its last day, without repeating it.
  assert.deepEqual(paydaysInMonth({ kind: "MONTH_DAYS", days: [14, 30, 31] }, "2026-02"), ["2026-02-14", "2026-02-28"]);
});

test("pay days are typed as days of the month", () => {
  assert.deepEqual(parsePayDays("28, 14"), [14, 28]);
  assert.deepEqual(parsePayDays("15 30 15"), [15, 30]);
  assert.equal(parsePayDays(""), null);
  assert.equal(parsePayDays("0, 32"), null);
  assert.equal(parsePayDays("1,2,3,4,5,6,7,8,9"), null);
});

test("an incomplete stored rhythm counts as daily", () => {
  assert.deepEqual(incomeRhythmOf({ kind: "WEEKLY", anchor: null, days: [] }), { kind: "DAILY" });
  assert.deepEqual(incomeRhythmOf({ kind: "MONTH_DAYS", anchor: null, days: [14, 28] }), { kind: "MONTH_DAYS", days: [14, 28] });
});

test("needed per payday spreads the shortfall and coming everyday spending over the paydays left", () => {
  const rhythm = { kind: "MONTH_DAYS" as const, days: [14, 28] };
  // Oct 10: 22 days left, paydays 14 and 28 left; shortfall 9,000 + 22 × 100 everyday = 11,200 → 5,600 each.
  const needed = neededPerPayday({ month: "2026-10", today: "2026-10-10", rhythm, toPayCents: 1000000, incomeCents: 100000, goalProgressCents: 0, typicalDailyCents: 10000 });
  assert.deepEqual(needed, { paydaysLeft: 2, cents: 560000, forGoalCents: null });
  // After the last payday the whole shortfall shows.
  assert.equal(neededPerPayday({ month: "2026-10", today: "2026-10-29", rhythm, toPayCents: 300000, incomeCents: 100000, goalProgressCents: 0 })?.cents, 200000);
  assert.equal(neededPerPayday({ month: "2026-09", today: "2026-10-10", rhythm, toPayCents: 0, incomeCents: 0, goalProgressCents: 0 }), null);
  // A daily rhythm matches needed per day: shortfall ÷ days left + typical daily spending.
  const daily = neededPerPayday({ month: "2026-10", today: "2026-10-10", rhythm: { kind: "DAILY" }, toPayCents: 1000000, incomeCents: 100000, goalProgressCents: 0, typicalDailyCents: 10000 });
  assert.equal(daily?.cents, Math.ceil(900000 / 22 + 10000));
});

test("income per payday averages over the paydays passed", () => {
  const rhythm = { kind: "MONTH_DAYS" as const, days: [1, 15] };
  assert.deepEqual(incomePerPayday({ month: "2026-10", today: "2026-10-20", rhythm, incomeCents: 400000, everydaySpendingCents: 100000 }), { paydaysPassed: 2, grossCents: 200000, netCents: 150000 });
  assert.equal(incomePerPayday({ month: "2026-10", today: "2026-10-10", rhythm: { kind: "MONTH_DAYS", days: [14] }, incomeCents: 0, everydaySpendingCents: 0 }), null);
});
