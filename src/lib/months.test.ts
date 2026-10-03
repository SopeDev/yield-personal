import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, isDateKey, isMonthKey, monthDifference, monthRange } from "./months";

test("adds months across year boundaries", () => {
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", -47), "2022-11");
});

test("measures month differences", () => {
  assert.equal(monthDifference("2026-10", "2027-01"), 3);
  assert.equal(monthDifference("2026-10", "2026-09"), -1);
});

test("validates month and date keys", () => {
  assert.ok(isMonthKey("2026-10"));
  assert.ok(!isMonthKey("2026-13"));
  assert.ok(isDateKey("2026-02-28"));
  assert.ok(!isDateKey("2026-02-30"));
});

test("builds a half-open month range", () => {
  const { start, end } = monthRange("2026-12");
  assert.equal(start.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(end.toISOString(), "2027-01-01T00:00:00.000Z");
});
