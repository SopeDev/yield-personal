import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, axisTicks, billEvents, cardStatementEvents, compactAmount, forecastCash, paydayEvents, type ForecastEvent } from "./forecast";
import { dateFromKey } from "./months";
import type { LedgerPaymentMethod } from "./ledger";
import type { RecurringOccurrence } from "./recurring";
import type { ExpectedPayday } from "./recurring-income";
import type { Statement } from "./statements";

const rent = { id: "rent", name: "Renta", category: { id: "fixed", key: "fixed", name: null, sortOrder: 0, kind: "BILLS" as const } };
const cash: LedgerPaymentMethod = { id: "cash", kind: "CASH", name: "Cash", color: "#000" };
const nu: LedgerPaymentMethod = { id: "nu", kind: "CARD", name: "Nu", color: "#000" };

function occurrence(date: string, amountCents: number, extra: Partial<RecurringOccurrence> = {}, method = cash): RecurringOccurrence {
  return {
    recurring: { id: `r-${date}`, item: rent, amountCents, isVariable: false, intervalMonths: 1, dayOfMonth: Number(date.slice(8)), startMonth: dateFromKey("2026-08-01"), endMonth: null, paymentMethod: method },
    month: date.slice(0, 7) as RecurringOccurrence["month"],
    date: dateFromKey(date),
    chargeDate: dateFromKey(date),
    amountCents,
    amountChanged: false,
    estimated: false,
    cashPaidAt: null,
    ...extra,
  };
}

test("cash runs day by day: the rest of today, then pace less cash spending, plus each day's events", () => {
  const events: ForecastEvent[] = [
    { date: "2026-10-16", kind: "bill", label: "Luz", cents: -50000, estimated: true, overdue: false },
    { date: "2026-10-17", kind: "income", label: "Asesoría", cents: 200000, estimated: false, overdue: false },
  ];
  const forecast = forecastCash({
    today: "2026-10-14", days: 4, startCents: 100000, paceDailyCents: 170000, cashDailyCents: 60000,
    todayIncomeCents: 100000, todayCashSpentCents: 21500, events,
  });
  // Today: 700 more income, 385 more spending → 1,000 + 700 − 385 = 1,315; then +1,100 a day.
  assert.deepEqual(forecast.days.map((day) => day.cents), [131500, 241500, 301500, 611500, 721500]);
  assert.equal(forecast.dailyDriftCents, 110000);
  assert.deepEqual(forecast.days[2].events.map((event) => event.label), ["Luz"]);
  // A day already past its average adds nothing more for today.
  assert.equal(forecastCash({ today: "2026-10-14", days: 0, startCents: 0, paceDailyCents: 1000, cashDailyCents: 500, todayIncomeCents: 3000, todayCashSpentCents: 900, events: [] }).days[0].cents, 0);
});

test("big bills step the line down on their dates", () => {
  const forecast = forecastCash({
    today: "2026-10-30", days: 6, startCents: 2000000, paceDailyCents: 100000, cashDailyCents: 0,
    events: [
      { date: "2026-11-01", kind: "bill", label: "Renta", cents: -1190000, estimated: false, overdue: false },
      { date: "2026-11-05", kind: "bill", label: "Colegiatura", cents: -475000, estimated: false, overdue: false },
    ],
  });
  // 20,000 +1,000 (Oct 30) +1,000 (31) +1,000 −11,900 (Nov 1) … +1,000 −4,750 (Nov 5).
  assert.equal(forecast.days.find((day) => day.date === "2026-11-01")?.cents, 2000000 + 3 * 100000 - 1190000);
  assert.equal(forecast.days.at(-1)?.cents, 2000000 + 7 * 100000 - 1190000 - 475000);
});

test("cash bills fall on their due dates, overdue ones on today; card and paid bills are left out", () => {
  const events = billEvents([
    occurrence("2026-10-08", 43400),
    occurrence("2026-10-20", 95100, { estimated: true }),
    occurrence("2026-10-05", 475000, { cashPaidAt: new Date() }),
    occurrence("2026-10-12", 29900, {}, nu),
    occurrence("2027-02-01", 1190000),
  ], { today: "2026-10-14", end: "2027-01-12" });
  assert.deepEqual(events.map((event) => [event.date, event.cents, event.estimated, event.overdue]), [
    ["2026-10-14", -43400, false, true],
    ["2026-10-20", -95100, true, false],
  ]);
});

test("a card's statements: what's charged so far plus its typical spending for the cycle's days still to come", () => {
  const statement = (month: string, totalCents: number, paid = false): Statement => ({
    paymentMethodId: "nu", month: month as Statement["month"], closingDate: dateFromKey(`${month}-05`), dueDate: dateFromKey(`${month}-25`),
    dueMonth: month as Statement["month"], totalCents, charges: [], paid,
  });
  const card = { id: "nu", name: "Nu", closingDay: 5, paymentDays: 20, archived: false, dailyCents: 10000, todaySpentCents: 4000 };
  const events = cardStatementEvents({
    today: "2026-10-14",
    end: "2026-12-31",
    card,
    statements: [statement("2026-09", 80000, true), statement("2026-10", 120000), statement("2026-11", 33300), statement("2026-12", 33300)],
  });
  assert.deepEqual(events.map((event) => [event.date, event.cents, event.estimated]), [
    // Closed Oct 5, due Oct 25: exactly what's on it.
    ["2026-10-25", -120000, false],
    // Open Oct 6 – Nov 5: an installment, 600 left of today's 1,000, and 22 more days (Oct 15 – Nov 5) at 1,000.
    ["2026-11-25", -(33300 + 6000 + 22 * 10000), true],
    // Nov 6 – Dec 5: an installment and all 30 days.
    ["2026-12-25", -(33300 + 30 * 10000), true],
  ]);
  // An archived card only owes what's already on its statements.
  assert.deepEqual(
    cardStatementEvents({ today: "2026-10-14", end: "2026-12-31", card: { ...card, archived: true }, statements: [statement("2026-11", 33300)] }).map((event) => event.cents),
    [-33300],
  );
});

test("recurring income not received yet falls on its payday, or today once it's past", () => {
  const recurring = { id: "w", source: { id: "s", name: "Asesoría", groupId: null }, amountCents: 250000, rhythm: { kind: "WEEKLY" as const, anchor: "2026-10-02" }, startsOn: "2026-09-01" };
  const paydays: ExpectedPayday[] = [
    { recurring, date: "2026-10-09", received: { id: "i", date: new Date(), amountCents: 245000, recurringIncomeId: "w", expectedOn: new Date() } },
    { recurring, date: "2026-10-12", received: null },
    { recurring, date: "2026-10-16", received: null },
  ];
  assert.deepEqual(paydayEvents(paydays, { today: "2026-10-14", end: "2026-10-31" }).map((event) => [event.date, event.cents, event.overdue]), [
    ["2026-10-14", 250000, true],
    ["2026-10-16", 250000, false],
  ]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("without work, cash only falls: everyday spending, bills and statements, no income; the runway is the first day below zero", () => {
  const forecast = forecastCash({
    today: "2026-10-14", days: 3, startCents: 100000, paceDailyCents: 170000, cashDailyCents: 30000, todayCashSpentCents: 10000,
    events: [
      { date: "2026-10-15", kind: "income", label: "Asesoría", cents: 200000, estimated: false, overdue: false },
      { date: "2026-10-16", kind: "bill", label: "Luz", cents: -50000, estimated: false, overdue: false },
    ],
  });
  // 1,000 − 200 left of today; −300 a day; the income never arrives; Luz −500 on the 16th.
  assert.deepEqual(forecast.days.map((day) => day.withoutWorkCents), [80000, 50000, -30000, -60000]);
  assert.equal(forecast.runway, "2026-10-16");
  assert.equal(forecastCash({ today: "2026-10-14", days: 2, startCents: 100000, paceDailyCents: 0, cashDailyCents: 100, events: [] }).runway, null);
});

test("the amount axis steps by round numbers and reads them short", () => {
  assert.deepEqual(axisTicks(-5500000, 4200000), [-4000000, -2000000, 0, 2000000, 4000000]);
  assert.deepEqual(axisTicks(500000, 1300000), [600000, 800000, 1000000, 1200000]);
  assert.deepEqual([4000000, 250000, 50000, -1000000, 0].map(compactAmount), ["40k", "2.5k", "500", "−10k", "0"]);
});
