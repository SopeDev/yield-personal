import assert from "node:assert/strict";
import { test } from "node:test";
import { averageMonthlySpending } from "./averages";
import type { MonthKey } from "./months";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const food = { id: "food", key: "food", name: null, sortOrder: 1, includeInAverage: true };
const car = { id: "car", key: "car", name: null, sortOrder: 2, includeInAverage: true };
const extras = { id: "extras", key: "extras", name: null, sortOrder: 3, includeInAverage: false };

test("reproduces the spreadsheet's average monthly spending", () => {
  // Fixed: 17,400 in October and 13,500 for the other 11 months; food and car only have October data.
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, "0")}` as MonthKey,
    byCategory: [
      { category: fixed, totalCents: index === 0 ? 1740000 : 1350000 },
      { category: food, totalCents: index === 0 ? 18000 : 0 },
      { category: car, totalCents: index === 0 ? 123000 : 0 },
      { category: extras, totalCents: 58400 },
    ],
  }));

  const average = averageMonthlySpending(months);
  assert.deepEqual(average.byCategory.map((item) => [item.category.id, item.averageCents, item.monthsWithData]), [
    ["fixed", 1382500, 12],
    ["food", 18000, 1],
    ["car", 123000, 1],
  ]);
  assert.equal(average.totalCents, 1523500);
});

test("returns zero with no spending", () => {
  assert.equal(averageMonthlySpending([]).totalCents, 0);
});
