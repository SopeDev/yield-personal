import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/messages/en.json";
import type { LedgerIncome, LedgerPurchase } from "./ledger";
import { summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";
import {
  availableStats, cardLayout, defaultCardLayout, isStatRef, monthStatContext, parseSummaryCards, resolveStats, statLabel, statShown, type StatRef, type StatSettings,
} from "./stats";

const food = { id: "food", key: "food", name: null, sortOrder: 0, kind: "EVERYDAY" as const };
const car = { id: "car", key: "car", name: null, sortOrder: 1, kind: "EVERYDAY" as const };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const noSettings: StatSettings = { balanceGoalCents: null, historyStartMonth: null };

function purchase(id: string, date: string, amountCents: number, category: LedgerPurchase["item"]["category"]): LedgerPurchase {
  return { id, date: dateFromKey(date), amountCents, note: null, installmentCount: 1, item: { id, name: id, category }, paymentMethod: cash };
}

function income(id: string, date: string, amountCents: number, source: LedgerIncome["source"]): LedgerIncome {
  return { id, date: dateFromKey(date), amountCents, note: null, source };
}

const uber = { id: "uber", name: "Uber", groupId: "rideshare" };
const salary = { id: "salary", name: "Salary", groupId: null };

function context(incomes: LedgerIncome[], { today = "2026-10-10", settings = noSettings, cashOnHandCents = null as number | null } = {}) {
  const data: LedgerData = {
    categories: [food, car],
    purchases: [purchase("gas", "2026-10-02", 40000, car), purchase("pho", "2026-10-04", 20000, food)],
    incomes,
    incomeGroups: [{ id: "rideshare", name: "Rideshare", deductCategoryIds: ["car"] }],
    definitions: [],
    overrides: [],
    recurringHistory: [],
    statements: [],
    savingsMovements: [],
  };
  const summary = summarizeMonth(data, "2026-10");
  return monthStatContext({ view: { ...summary, purchases: data.purchases }, today, settings, cashOnHandCents });
}

const labels = (refs: StatRef[], ctx: ReturnType<typeof context>) => resolveStats(refs, ctx, en).map((stat) => stat.label);

test("the month card shows balance with goal progress, then its six stats in order", () => {
  const ctx = context([income("u1", "2026-10-01", 100000, uber)], { settings: { balanceGoalCents: 50000, historyStartMonth: null } });
  const monthCard = defaultCardLayout("month", ctx);
  const [balance] = resolveStats([monthCard.headline], ctx, en);
  // Balance: 1,000 income − 600 paid in cash; 100 short of the 500 goal.
  assert.deepEqual(balance.value, { cents: 40000, tone: "gain", note: { text: "Goal $500.00 · $100.00 to go", tone: "muted" } });
  assert.deepEqual(labels(monthCard.grid, ctx), ["Income", "Outstanding", "Spending", "To pay", "Needed per day", "Daily income"]);
});

test("figures that have no value this month read as none", () => {
  // In a month that has ended there is nothing left to need per day.
  const ended = context([], { today: "2026-11-05" });
  const [needed] = resolveStats(["neededPerDay"], ended, en);
  assert.equal(needed.value, null);
  // A month that hasn't started has no daily income yet.
  const ahead = context([], { today: "2026-09-20" });
  assert.equal(resolveStats(["dailyIncome"], ahead, en)[0].value, null);
});

test("the income card names a single deducted category and hides a group's pair when it holds all income", () => {
  const onlyRideshare = context([income("u1", "2026-10-01", 100000, uber)]);
  const card = defaultCardLayout("income", onlyRideshare);
  assert.deepEqual(labels(card.grid, onlyRideshare), ["Car spending", "Net", "Daily avg. gross", "Daily avg. net"]);
  assert.deepEqual(resolveStats(["deductions"], onlyRideshare, en)[0].value, { cents: -40000, tone: "muted" });

  const mixed = context([income("u1", "2026-10-01", 100000, uber), income("s1", "2026-10-02", 300000, salary)]);
  const mixedStats = resolveStats(defaultCardLayout("income", mixed).grid, mixed, en);
  assert.deepEqual(mixedStats.slice(4).map((stat) => [stat.label, stat.value?.cents]), [["Rideshare gross", 100000], ["Rideshare net", 60000]]);
});

test("deductions are hidden without income groups deducting a category, and unknown stats are skipped", () => {
  const ctx = context([]);
  const noDeductions = { ...ctx, income: { ...ctx.income, deductCategoryIds: [] } };
  assert.deepEqual(labels(["deductions", "netIncome", "incomeDayGross"], noDeductions), ["Daily avg. gross"]);
  assert.deepEqual(labels(["toString", "nope"] as unknown as StatRef[], ctx), []);
});

test("cash on hand reads as none until it is set, and as a loss when it runs below zero", () => {
  assert.equal(resolveStats(["cashOnHand"], context([]), en)[0].value, null);
  assert.deepEqual(resolveStats(["cashOnHand"], context([], { cashOnHandCents: 346300 }), en)[0], {
    ref: "cashOnHand", label: "Cash on hand", value: { cents: 346300, tone: "gain" },
  });
  assert.equal(resolveStats(["cashOnHand"], context([], { cashOnHandCents: -5000 }), en)[0].value?.tone, "loss");
});

test("with paydays, the month card swaps the daily pair for needed and income per payday", () => {
  // Paid on the 1st and 15th; on Oct 10 the 1st has passed and the 15th is left.
  const settings: StatSettings = { ...noSettings, incomeRhythm: { kind: "MONTH_DAYS", days: [1, 15] } };
  const ctx = context([income("s1", "2026-10-01", 100000, salary)], { settings });
  const card = defaultCardLayout("month", ctx);
  assert.deepEqual(card.grid.slice(4), ["neededPerPayday", "incomePerPayday"]);
  const [needed, perPayday] = resolveStats(card.grid.slice(4), ctx, en);
  assert.equal(needed.label, "Needed per payday");
  assert.equal(needed.value?.note?.text, "1 payday left");
  // Income per payday: 1,000 over one payday passed, net of 600 everyday spending.
  assert.deepEqual(perPayday.value, { cents: 100000, tone: "gain", note: { text: "net $400.00", tone: "muted" } });
  // The per-payday stats stay hidden, and aren't offered, with a daily rhythm.
  const daily = context([]);
  assert.deepEqual(labels(["neededPerPayday", "incomePerPayday"], daily), []);
  assert.equal(availableStats(daily, []).includes("neededPerPayday"), false);
});

test("a customized card replaces the default, and stored cards keep only known stats", () => {
  const ctx = context([]);
  const stored = parseSummaryCards({
    month: { headline: "cashOnHand", grid: ["spending", "nope", "groupNet:rideshare", "groupNet:", 4] },
    income: { headline: "nope", grid: [] },
    other: { headline: "balance", grid: [] },
  });
  assert.deepEqual(stored, { month: { headline: "cashOnHand", grid: ["spending", "groupNet:rideshare"] } });
  assert.deepEqual(cardLayout("month", stored, ctx), stored.month);
  assert.deepEqual(cardLayout("income", stored, ctx), defaultCardLayout("income", ctx));
  assert.deepEqual(parseSummaryCards(null), {});
  assert.equal(isStatRef("groupGross"), false);
  assert.equal(isStatRef("spending:x"), false);
});

test("the editor names group stats from the group list even in a month without their income", () => {
  const settings = noSettings;
  const data = context([]);
  const ctx = monthStatContext({ view: data, today: "2026-10-10", settings, incomeGroups: [{ id: "rideshare", name: "Rideshare" }] });
  assert.equal(statLabel("groupNet:rideshare", ctx, en), "Rideshare net");
  assert.equal(statShown("groupNet:rideshare", ctx), false);
  assert.deepEqual(availableStats(ctx, [{ id: "rideshare" }]).filter((ref) => ref.startsWith("group")), ["groupGross:rideshare", "groupNet:rideshare"]);
});
