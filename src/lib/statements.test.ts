import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey, dateKeyOf } from "./months";
import { buildStatements, statementDates, statementMonthOf } from "./statements";

test("charges up to and including the closing day stay on that month's statement", () => {
  assert.equal(statementMonthOf(dateFromKey("2026-10-25"), 25), "2026-10");
  assert.equal(statementMonthOf(dateFromKey("2026-10-28"), 25), "2026-11");
});

test("a closing day past the month's end closes on the last day", () => {
  assert.equal(statementMonthOf(dateFromKey("2027-02-28"), 31), "2027-02");
  assert.equal(dateKeyOf(statementDates({ closingDay: 31, dueDay: 20 }, "2027-02").closingDate), "2027-02-28");
});

test("payment is due the same month when the due day is after the closing day", () => {
  const dates = statementDates({ closingDay: 5, dueDay: 25 }, "2026-10");
  assert.equal(dateKeyOf(dates.dueDate), "2026-10-25");
  assert.equal(dates.dueMonth, "2026-10");
});

test("payment is due the next month when the due day is before the closing day", () => {
  const dates = statementDates({ closingDay: 25, dueDay: 15 }, "2026-10");
  assert.equal(dateKeyOf(dates.dueDate), "2026-11-15");
});

test("a card that closes and is due on the same day is due one month after closing", () => {
  const dates = statementDates({ closingDay: 15, dueDay: 15 }, "2026-10");
  assert.equal(dateKeyOf(dates.closingDate), "2026-10-15");
  assert.equal(dateKeyOf(dates.dueDate), "2026-11-15");
  assert.equal(dates.dueMonth, "2026-11");
});

test("installments land on consecutive statements and recurring charges join the right one", () => {
  const card = { id: "klar", closingDay: 25, dueDay: 15 };
  const statements = buildStatements(
    card,
    [{ id: "escritorio", description: "Escritorio Leo", date: dateFromKey("2026-10-28"), amountCents: 66600, installmentCount: 2 }],
    [{ id: "netflix", description: "Netflix", date: dateFromKey("2026-11-10"), amountCents: 21900 }],
    new Set(["2026-11"]),
  );

  assert.deepEqual(statements.map((statement) => [statement.month, statement.totalCents, statement.paid]), [
    ["2026-11", 55200, true],
    ["2026-12", 33300, false],
  ]);
  assert.equal(dateKeyOf(statements[0].dueDate), "2026-12-15");
});
