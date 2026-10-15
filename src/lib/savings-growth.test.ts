import assert from "node:assert/strict";
import { test } from "node:test";
import { forecastCash } from "./forecast";
import { dailyInterestCents, depositDays, matchDeposits, parseRatePercent, projectSavings, ratePercent, rateOn, type GrowingFund } from "./savings-growth";

const fund = (changes: Partial<GrowingFund>): GrowingFund => ({
  id: "f", name: "Ahorro Flexible Ultra", balanceCents: 200000, rateBps: 1500, rateUntil: null, afterBps: null, deposit: null, doneDates: [], ...changes,
});

test("a fund earns its daily share of the annual rate, compounding, and its promotional rate ends after its last day", () => {
  // 2,000 at 15%: 0.82 a day, as the bank shows.
  assert.equal(Math.round(dailyInterestCents(fund({}), "2026-10-15")), 82);
  const promo = fund({ rateUntil: "2026-12-12", afterBps: 850 });
  assert.deepEqual([rateOn(promo, "2026-12-12"), rateOn(promo, "2026-12-13")], [1500, 850]);
  const year = projectSavings({ today: "2026-01-01", days: 364, funds: [fund({})] });
  // A year of daily compounding at 15%: about 16.18%.
  assert.equal(year.days.at(-1)!.savingsCents, Math.round(200000 * (1 + 0.15 / 365) ** 365));
  assert.equal(year.days.at(-1)!.interestCents, year.days.at(-1)!.savingsCents - 200000);
});

test("planned deposits move money from cash into the fund on their days, and today's counts unless it's done", () => {
  assert.deepEqual(depositDays({ kind: "MONTH_DAYS", days: [15, 30] }, "2026-10-15", "2026-11-30"), ["2026-10-15", "2026-10-30", "2026-11-15", "2026-11-30"]);
  const deposit = { cents: 100000, rhythm: { kind: "MONTH_DAYS" as const, days: [15, 30] } };
  const growth = projectSavings({ today: "2026-10-15", days: 20, funds: [fund({ rateBps: null, deposit })] });
  assert.deepEqual(growth.events.map((event) => [event.date, event.cents, event.kind]), [["2026-10-15", -100000, "savings"], ["2026-10-30", -100000, "savings"]]);
  assert.equal(growth.days.at(-1)!.savingsCents, 400000);
  assert.equal(projectSavings({ today: "2026-10-15", days: 20, funds: [fund({ rateBps: null, deposit, doneDates: ["2026-10-15"] })] }).events.length, 1);
  // The deposits lower cash on their days, but aren't spending.
  const cash = forecastCash({ today: "2026-10-15", days: 2, startCents: 500000, paceDailyCents: 0, cashDailyCents: 0, events: growth.events });
  assert.deepEqual(cash.days.map((day) => [day.cents, day.spendingCents]), [[400000, 0], [400000, 0], [400000, 0]]);
});

test("rates are typed as percentages and kept in basis points", () => {
  assert.deepEqual(["15", "8.5", "8,5", " 12 % ", "0", "-3", "120", "", "lots"].map(parseRatePercent), [1500, 850, 850, 1200, null, null, null, null, null]);
  assert.deepEqual([1500, 850].map(ratePercent), ["15", "8.5"]);
});

test("a planned deposit is made by a deposit into its fund from 3 days before to 10 days after, each deposit counting once", () => {
  const movement = (date: string, amountCents = 100000) => ({ date, amountCents });
  const made = matchDeposits(["2026-10-15", "2026-10-30"], [movement("2026-10-03"), movement("2026-10-13"), movement("2026-10-20", -5000), movement("2026-11-02", 80000)]);
  // The 3rd is too early for the 15th; the 13th makes it. A withdrawal never counts; Nov 2 makes the 30th, at what was put in.
  assert.deepEqual([...made].map(([day, match]) => [day, match?.date ?? null, match?.amountCents ?? null]), [["2026-10-15", "2026-10-13", 100000], ["2026-10-30", "2026-11-02", 80000]]);
  assert.equal(matchDeposits(["2026-10-15"], [movement("2026-10-26")]).get("2026-10-15"), null);
});
