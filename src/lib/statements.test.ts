import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey, dateKeyOf } from "./months";
import { buildStatements, currentStatements, statementDates, statementMonthOf, type Statement } from "./statements";

test("charges up to and including the closing day stay on that month's statement", () => {
  assert.equal(statementMonthOf(dateFromKey("2026-10-25"), 25), "2026-10");
  assert.equal(statementMonthOf(dateFromKey("2026-10-28"), 25), "2026-11");
});

test("a closing day past the month's end closes on the last day", () => {
  assert.equal(statementMonthOf(dateFromKey("2027-02-28"), 31), "2027-02");
  assert.equal(dateKeyOf(statementDates({ closingDay: 31, paymentDays: 15 }, "2027-02").closingDate), "2027-02-28");
});

test("payment is due a number of days after closing, within the month or into the next", () => {
  // Nu: closes on the 9th, due 15 days later on the 24th.
  const nu = statementDates({ closingDay: 9, paymentDays: 15 }, "2026-10");
  assert.equal(dateKeyOf(nu.dueDate), "2026-10-24");
  assert.equal(nu.dueMonth, "2026-10");

  // DiDi: closes on the 22nd, due 15 days later in the next month.
  const didi = statementDates({ closingDay: 22, paymentDays: 15 }, "2026-10");
  assert.equal(dateKeyOf(didi.dueDate), "2026-11-06");
  assert.equal(didi.dueMonth, "2026-11");
});

test("a 30-day card is due 30 days after closing, whatever the month's length", () => {
  // Plata: closes on the 13th, due 30 days later.
  assert.equal(dateKeyOf(statementDates({ closingDay: 13, paymentDays: 30 }, "2026-10").dueDate), "2026-11-12");
  assert.equal(dateKeyOf(statementDates({ closingDay: 13, paymentDays: 30 }, "2027-02").dueDate), "2027-03-15");
});

test("installments land on consecutive statements and recurring charges join the right one", () => {
  const card = { id: "klar", closingDay: 25, paymentDays: 20 };
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

test("the statements shown first: unpaid ones however old, the last one paid, and those still to close", () => {
  const statement = (month: string, closing: string, paid: boolean) =>
    ({ month, closingDate: dateFromKey(closing), dueDate: dateFromKey(closing), paid, totalCents: 100, charges: [] }) as unknown as Statement;
  const list = [
    statement("2026-06", "2026-06-09", false), // unpaid, months old
    statement("2026-08", "2026-08-09", true),
    statement("2026-09", "2026-09-09", true),
    statement("2026-10", "2026-10-09", true), // the last paid
    statement("2026-11", "2026-11-09", false), // closed, due
    statement("2026-12", "2026-12-09", false), // open
    statement("2027-01", "2027-01-09", false), // upcoming
  ];
  const { shown, hasHistory } = currentStatements(list, "2026-11-12", "2025-11");
  assert.deepEqual(shown.map((item) => item.month), ["2026-06", "2026-10", "2026-11", "2026-12", "2027-01"]);
  assert.equal(hasHistory, true);
  // Unpaid ones older than the month view carries are history only.
  assert.deepEqual(currentStatements(list, "2026-11-12", "2026-07").shown.map((item) => item.month), ["2026-10", "2026-11", "2026-12", "2027-01"]);
  assert.equal(currentStatements([statement("2026-12", "2026-12-09", false)], "2026-11-12", "2025-11").hasHistory, false);
});
