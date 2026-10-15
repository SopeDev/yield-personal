import assert from "node:assert/strict";
import { test } from "node:test";
import type { LedgerItem } from "./ledger";
import { dateFromKey } from "./months";
import { averageSpending, parseSpendingParam, periodStart, spendingParam } from "./spending-average";

const food = { id: "food", key: "food", name: null, sortOrder: 0, kind: "EVERYDAY" as const };
const car = { id: "car", key: "car", name: null, sortOrder: 1, kind: "OCCASIONAL" as const };
const coffee = { id: "coffee", name: "Café", category: food };
const tacos = { id: "tacos", name: "Tacos", category: food };
const tires = { id: "tires", name: "Llantas", category: car };
const buy = (date: string, item: LedgerItem, amountCents: number) => ({ date: dateFromKey(date), item, amountCents });

test("a period's usual spending on a scope, from the finished days of the last full months, and what's spent so far in it", () => {
  const purchases = [
    buy("2026-07-15", coffee, 6000), buy("2026-08-20", coffee, 6000), buy("2026-09-10", coffee, 6000),
    buy("2026-09-11", tacos, 9200), buy("2026-08-01", tires, 300000),
    // This week (Mon Oct 12 – today, Wed Oct 14), and last week.
    buy("2026-10-12", coffee, 4500), buy("2026-10-14", coffee, 4500), buy("2026-10-09", coffee, 4500),
  ];
  // Jul 1 – Oct 13: 105 days.
  const weekly = averageSpending({ purchases, today: "2026-10-14", period: "week", scope: { kind: "item", id: "coffee" } });
  assert.equal(weekly.days, 105);
  assert.equal(weekly.totalCents, 6000 * 3 + 4500 * 2);
  assert.equal(weekly.averageCents, Math.round(27000 / 105) * 7);
  assert.equal(weekly.soFarCents, 9000);
  // A category takes all its items; "all" is everyday spending, so tires stay out.
  assert.equal(averageSpending({ purchases, today: "2026-10-14", period: "month", scope: { kind: "category", id: "food" } }).totalCents, 27000 + 9200);
  assert.equal(averageSpending({ purchases, today: "2026-10-14", period: "day", scope: { kind: "all" } }).soFarCents, 4500);
  assert.equal(averageSpending({ purchases, today: "2026-10-14", period: "month", scope: { kind: "category", id: "car" } }).averageCents, Math.round(Math.round(300000 / 105) * 30.4));
});

test("periods start today, on Monday, or on the 1st; the parameter reads back what it wrote", () => {
  assert.equal(periodStart("2026-10-14", "week"), "2026-10-12");
  assert.equal(periodStart("2026-10-18", "week"), "2026-10-12");
  assert.equal(periodStart("2026-10-12", "week"), "2026-10-12");
  assert.equal(periodStart("2026-10-14", "month"), "2026-10-01");
  assert.deepEqual(parseSpendingParam(spendingParam("week", { kind: "item", id: "cm1abc" })), { period: "week", scope: { kind: "item", id: "cm1abc" } });
  assert.deepEqual(parseSpendingParam("day:all"), { period: "day", scope: { kind: "all" } });
  for (const bad of ["year:all", "week", "week:item.", "week:thing.x", "week:item.a:b"]) assert.equal(parseSpendingParam(bad), null);
});
