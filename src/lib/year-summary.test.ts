import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/messages/en.json";
import type { MonthKey } from "./months";
import { summarizeYear, yearCardStats } from "./year-summary";

/** A month with only the figures the year summary reads. */
function month(key: string, { income = 0, toPay = 0, spending = 0, saved = 0 } = {}) {
  return {
    month: key as MonthKey,
    income: { totalCents: income },
    spending: { totalCents: spending },
    cashFlow: { toPayCents: toPay },
    savingsNetCents: saved,
    balanceCents: income - toPay,
  } as unknown as Parameters<typeof summarizeYear>[0]["months"][number];
}

const year = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`);
const months = year.map((key) => ({
  "2026-07": month(key, { income: 3000000, toPay: 2500000, spending: 2000000 }),
  "2026-08": month(key, { income: 2000000, toPay: 2600000, spending: 2100000 }),
  "2026-09": month(key, { income: 3000000, toPay: 2900000, spending: 2200000, saved: 400000 }),
  "2026-10": month(key, { income: 1500000, toPay: 2800000, spending: 2700000 }),
  // Scheduled bills in a month that hasn't started.
  "2026-11": month(key, { toPay: 1700000, spending: 1700000 }),
}[key] ?? month(key)));

test("a year counts the months that started, from the history start on", () => {
  const summary = summarizeYear({ months, currentMonth: "2026-10", historyStart: "2026-07", goalCents: 400000 });
  assert.equal(summary.monthsCounted, 4);
  assert.equal(summary.incomeCents, 9500000);
  assert.equal(summary.toPayCents, 10800000);
  assert.equal(summary.savedCents, 400000);
  // 5,000 − 6,000 + 1,000 − 13,000 = −13,000; −3,250 a month; July was the best.
  assert.equal(summary.balanceCents, -1300000);
  assert.equal(summary.averageBalanceCents, -325000);
  assert.deepEqual(summary.best, { month: "2026-07", balanceCents: 500000 });
  // July reached 4,000, and so did September with its 4,000 saved; August missed; October is still under way.
  assert.deepEqual(summary.goalMonths, { reached: 2, of: 3 });
  assert.deepEqual(summary.bars.map((bar) => bar.balanceCents), [null, null, null, null, null, null, 500000, -600000, 100000, -1300000, null, null]);
  assert.deepEqual(summary.bars.slice(9, 11).map((bar) => [bar.upcoming, bar.goalLeftCents]), [[false, 1700000], [true, 2100000]]);
});

test("without a history start or goal every started month counts, and a year not started has nothing", () => {
  const summary = summarizeYear({ months, currentMonth: "2026-10" });
  assert.equal(summary.monthsCounted, 10);
  assert.equal(summary.goalMonths, null);
  const ahead = summarizeYear({ months, currentMonth: "2025-12" });
  assert.equal(ahead.monthsCounted, 0);
  assert.equal(ahead.averageBalanceCents, null);
  assert.equal(ahead.best, null);
});

test("the year card leads with the balance and how often the goal was reached, and explains its figures", () => {
  const card = yearCardStats(summarizeYear({ months, currentMonth: "2026-10", historyStart: "2026-07", goalCents: 400000 }), { messages: en, locale: "en" });
  assert.deepEqual(card.headline.value, { cents: -1300000, tone: "loss", note: { text: "Goal reached 2 of 3 months", tone: "gain" } });
  // The balance adds up each counted month's.
  assert.deepEqual(card.headline.explanation.blocks[0].map((line) => [line.op, line.label]), [
    [undefined, "July 2026"], ["+", "August 2026"], ["+", "September 2026"], ["+", "October 2026"], ["=", "Balance"],
  ]);
  assert.deepEqual(card.grid.map((stat) => stat.label), ["Income", "To pay", "Spending", "Saved", "Avg. balance", "Best month"]);
  assert.deepEqual(card.grid[5].value, { cents: 500000, tone: "gain", note: { text: "July 2026", tone: "muted" } });
  assert.deepEqual(card.grid[4].explanation.blocks[0].map((line) => line.figure), [{ cents: -1300000 }, { months: 4 }, { cents: -325000 }]);

  // Before any month counts, every figure is "–" and says why.
  const empty = yearCardStats(summarizeYear({ months, currentMonth: "2025-12" }), { messages: en, locale: "en" });
  assert.equal(empty.headline.value, null);
  assert.deepEqual(empty.headline.explanation, { blocks: [], notes: [en.year.noMonths] });
});
