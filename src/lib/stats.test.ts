import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/messages/en.json";
import es from "../i18n/messages/es.json";
import type { LedgerIncome, LedgerPurchase } from "./ledger";
import { summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";
import type { RecurringIncomeDefinition } from "./recurring-income";
import {
  availableStats, cardLayout, defaultCardLayout, explainStat, isStatRef, monthStatContext, parseSummaryCards, resolveStats, statDescription, statLabel, statShown,
  type StatFigure, type StatRef, type StatSettings,
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

function context(incomes: LedgerIncome[], { today = "2026-10-10", settings = noSettings, cashOnHandCents = null as number | null, recurringIncomes = [] as RecurringIncomeDefinition[] } = {}) {
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
  return monthStatContext({ view: { ...summary, purchases: data.purchases, recurringIncomes }, today, settings, cashOnHandCents });
}

const labels = (refs: StatRef[], ctx: ReturnType<typeof context>) => resolveStats(refs, ctx, en).map((stat) => stat.label);

test("the month card shows balance with goal progress, then its stats in order", () => {
  const ctx = context([income("u1", "2026-10-01", 100000, uber)], { settings: { balanceGoalCents: 50000, historyStartMonth: null } });
  const monthCard = defaultCardLayout("month", ctx);
  const [balance] = resolveStats([monthCard.headline], ctx, en);
  // Balance: 1,000 income − 600 paid in cash; 100 short of the 500 goal.
  assert.deepEqual(balance.value, { cents: 40000, tone: "gain", note: { text: "Goal $500.00 · $100.00 to go", tone: "muted" } });
  // Expected income stays hidden without recurring income.
  assert.deepEqual(labels(monthCard.grid, ctx), ["Income", "Outstanding", "Spending", "To pay", "Needed per day", "Daily income", "Projected balance"]);
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
  assert.deepEqual(card.grid.slice(4, 6), ["neededPerPayday", "incomePerPayday"]);
  const [needed, perPayday] = resolveStats(card.grid.slice(4, 6), ctx, en);
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

test("other currencies are noted beside the main currency's figures, never added to them", () => {
  const data: LedgerData = {
    categories: [food, car], purchases: [purchase("gas", "2026-10-02", 40000, car)], incomes: [income("i1", "2026-10-03", 150000, uber)],
    incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements: [], savingsMovements: [],
  };
  const summary = summarizeMonth(data, "2026-10");
  const others = [{ currency: "USD", incomeCents: 30000, spendingCents: 2500, toPayCents: 2500, outstandingCents: 0 }];
  const ctx = monthStatContext({
    view: { ...summary, purchases: data.purchases, others }, today: "2026-10-10", settings: noSettings,
    cashOnHandCents: 500000, otherCash: [{ currency: "USD", cents: 12000 }],
  });
  const [incomeStat, spendingStat, outstandingStat, cashStat] = resolveStats(["income", "spending", "outstanding", "cashOnHand"], ctx, en).map((stat) => stat.value);
  assert.deepEqual(incomeStat, { cents: 150000, note: { text: "+ US$300.00", tone: "muted" } });
  assert.deepEqual(spendingStat, { cents: 40000, note: { text: "+ US$25.00", tone: "muted" } });
  // Nothing outstanding in dollars, so no note.
  assert.equal(outstandingStat?.note, undefined);
  assert.deepEqual(cashStat, { cents: 500000, tone: "gain", note: { text: "+ US$120.00", tone: "muted" } });
});

test("days off left lead with the goal's and note breaking even, and only with daily income", () => {
  // Two days worked: 2,000 gross less 400 gas, so 800 net a day; 22 days left from Oct 10.
  const incomes = [income("u1", "2026-10-01", 100000, uber), income("u2", "2026-10-03", 100000, uber)];
  const withGoal = context(incomes, { settings: { ...noSettings, balanceGoalCents: 1000000 } });
  assert.deepEqual(resolveStats(["daysOff"], withGoal, en)[0], {
    ref: "daysOff", label: "Days off left", value: { days: 11, tone: "gain", note: { text: "22 to break even", tone: "muted" } },
  });
  // Without a goal: income already covers the month, so every day left is free.
  assert.deepEqual(resolveStats(["daysOff"], context(incomes), en)[0].value, { days: 22, tone: "gain", note: { text: "of 22 days left", tone: "muted" } });
  assert.equal(resolveStats(["daysOff"], context([]), en)[0].value, null);
  const paydays = context(incomes, { settings: { ...noSettings, incomeRhythm: { kind: "MONTH_DAYS", days: [1, 15] } } });
  assert.deepEqual(labels(["daysOff"], paydays), []);
  assert.equal(availableStats(paydays, []).includes("daysOff"), false);
});

test("the projected balance adds expected recurring income and the recent pace of other income, less typical spending", () => {
  // A salary on the 1st and 15th: the 1st was received, the 15th is still expected.
  const pay: RecurringIncomeDefinition = { id: "pay", source: salary, amountCents: 300000, rhythm: { kind: "MONTH_DAYS", days: [1, 15] }, startsOn: "2026-10-01" };
  const received = { ...income("s1", "2026-10-01", 300000, salary), recurringIncomeId: "pay", expectedOn: dateFromKey("2026-10-01") };
  const ctx = context([income("u1", "2026-10-01", 100000, uber), received], { settings: { ...noSettings, balanceGoalCents: 700000 }, recurringIncomes: [pay] });
  const [projected, expected, needed] = resolveStats(["projectedBalance", "expectedIncome", "neededPerDay"], ctx, en);
  // From Jul 1 to Oct 10 (102 days): Uber's 1,000 is 9.80 a day (the salary isn't pace), 600 everyday spending 5.88.
  // Balance 4,000 − 600 = 3,400, + 3,000 expected, + 22 days left × (9.80 − 5.88).
  assert.deepEqual(projected.value, { cents: 648624, tone: "gain", note: { text: "Goal $7,000.00 · $513.76 short", tone: "warning" } });
  assert.deepEqual(expected.value, { cents: 300000, note: { text: "1 payday left", tone: "muted" } });
  // The expected salary counts as coming: (7,000 − 6,400) ÷ 22 days + 5.88 a day, rounded up.
  assert.equal(needed.value?.cents, 3316);

  // Without a goal, the note names what is expected; with no recurring income, expected income is hidden.
  assert.deepEqual(resolveStats(["projectedBalance"], context([received], { recurringIncomes: [pay] }), en)[0].value?.note, { text: "incl. $3,000.00 expected", tone: "muted" });
  assert.deepEqual(labels(["projectedBalance", "expectedIncome"], context([])), ["Projected balance"]);
  // A month that has ended has nothing left to project.
  assert.deepEqual(labels(["projectedBalance", "expectedIncome"], context([], { today: "2026-11-05", recurringIncomes: [pay] })), []);
});

/** Runs each block of a stat's working like a receipt, checking every "=" line is what the lines above come to. */
function assertWorkingAddsUp(ref: StatRef, ctx: ReturnType<typeof context>) {
  const figureOf = (figure: StatFigure) => ("cents" in figure ? figure.cents : "days" in figure ? figure.days : "paydays" in figure ? figure.paydays : figure.months);
  for (const lines of explainStat(ref, ctx, en, "en").blocks) {
    let total = figureOf(lines[0].figure);
    assert.equal(lines[0].op, undefined, `${ref} starts its working with an operation`);
    for (const line of lines.slice(1)) {
      const figure = figureOf(line.figure);
      if (line.op === "+") total += figure;
      else if (line.op === "−") total -= figure;
      else if (line.op === "÷") total /= figure;
      else {
        // Results are rounded (up, for what's needed), never below zero, and an amount over the goal is shown as such.
        const close = Math.abs(Math.abs(total) - Math.abs(figure)) <= 1 || (figure === 0 && total <= 0);
        assert.ok(close, `${ref}: "${line.label}" is ${figure}, but its lines come to ${total}`);
        total = figure;
      }
    }
  }
}

test("each stat's working comes to the value it shows", () => {
  const pay: RecurringIncomeDefinition = { id: "pay", source: salary, amountCents: 300000, rhythm: { kind: "MONTH_DAYS", days: [1, 15] }, startsOn: "2026-10-01" };
  const received = { ...income("s1", "2026-10-01", 300000, salary), recurringIncomeId: "pay", expectedOn: dateFromKey("2026-10-01") };
  const incomes = [income("u1", "2026-10-01", 100000, uber), income("u2", "2026-10-03", 100000, uber), received];
  const parts = { countedCents: 346300, countedOn: "2026-10-07", incomeCents: 120000, purchasesCents: 15000, billsCents: 80000, savingsCents: 30000, transfersCents: -5000, cents: 336300 };
  const contexts = [
    context(incomes, { settings: { ...noSettings, balanceGoalCents: 700000 }, recurringIncomes: [pay] }),
    context(incomes, { recurringIncomes: [pay] }),
    context(incomes, { settings: { ...noSettings, balanceGoalCents: 700000, incomeRhythm: { kind: "MONTH_DAYS", days: [1, 15] } } }),
    context(incomes, { settings: { ...noSettings, incomeRhythm: { kind: "WEEKLY", anchor: "2026-10-02" } } }),
  ].map((ctx) => ({ ...ctx, cashOnHandCents: parts.cents, cashOnHandParts: parts }));
  for (const ctx of contexts) {
    const refs = availableStats(ctx, [{ id: "rideshare" }]).filter((ref) => statShown(ref, ctx));
    assert.ok(refs.length >= 15);
    for (const ref of refs) {
      assertWorkingAddsUp(ref, ctx);
      assert.notEqual(statDescription(ref, ctx, en), "");
      assert.notEqual(statDescription(ref, ctx, es), "");
    }
  }
});

test("the balance's working shows income less what was paid out, then how far it is from the goal", () => {
  const savings: LedgerData["savingsMovements"][number] = { id: "m1", fundId: "ef", date: dateFromKey("2026-10-05"), amountCents: 20000, note: null };
  const data: LedgerData = {
    categories: [food, car], purchases: [purchase("pho", "2026-10-04", 20000, food)], incomes: [income("u1", "2026-10-01", 100000, uber)],
    incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements: [], savingsMovements: [savings],
  };
  const summary = summarizeMonth(data, "2026-10");
  const ctx = monthStatContext({ view: { ...summary, purchases: data.purchases }, today: "2026-10-10", settings: { ...noSettings, balanceGoalCents: 90000 } });
  const working = explainStat("balance", ctx, en, "en");
  // 1,000 income − (200 pho + 200 into savings) = 600; the 900 goal less 600 and the 200 saved leaves 100.
  assert.deepEqual(working.blocks, [
    [
      { op: undefined, label: "Income", figure: { cents: 100000 } },
      { op: "−", label: "To pay", figure: { cents: 40000 } },
      { op: "=", label: "Balance", figure: { cents: 60000 } },
    ],
    [
      { op: undefined, label: "Goal", figure: { cents: 90000 } },
      { op: "−", label: "Balance", figure: { cents: 60000 } },
      { op: "−", label: "Moved into savings", figure: { cents: 20000 } },
      { op: "=", label: "Still to go", figure: { cents: 10000 } },
    ],
  ]);
  assert.deepEqual(working.notes, ["Money moved into savings counts toward the goal."]);
  // To pay names its parts, savings included.
  assert.deepEqual(explainStat("toPay", ctx, en, "en").blocks[0].map((line) => [line.op, line.label, line.figure]), [
    [undefined, "Cash purchases", { cents: 20000 }],
    ["+", "Moved into savings", { cents: 20000 }],
    ["=", "To pay", { cents: 40000 }],
  ]);
});

test("needed per day works from what's still to cover over the days left, plus everyday spending", () => {
  const pay: RecurringIncomeDefinition = { id: "pay", source: salary, amountCents: 300000, rhythm: { kind: "MONTH_DAYS", days: [1, 15] }, startsOn: "2026-10-01" };
  const received = { ...income("s1", "2026-10-01", 300000, salary), recurringIncomeId: "pay", expectedOn: dateFromKey("2026-10-01") };
  const ctx = context([income("u1", "2026-10-01", 100000, uber), received], { settings: { ...noSettings, balanceGoalCents: 700000 }, recurringIncomes: [pay] });
  const working = explainStat("neededPerDay", ctx, en, "en");
  assert.deepEqual(working.blocks[0].map((line) => [line.op, line.label, line.figure]), [
    [undefined, "Goal", { cents: 700000 }],
    ["+", "To pay", { cents: 60000 }],
    ["−", "Income", { cents: 400000 }],
    ["−", "Expected income", { cents: 300000 }],
    ["=", "Still to cover", { cents: 60000 }],
    ["÷", "Days left", { days: 22 }],
    ["+", "Everyday spending per day", { cents: 588 }],
    ["=", "Needed per day", { cents: 3316 }],
  ]);
  assert.deepEqual(working.notes, [
    "Without the goal, $0.00 a day covers the month.",
    "Everyday spending per day is your purchases in everyday categories over the last 102 days, divided by them. Recurring bills and installments of earlier purchases aren't included.",
  ]);
});

test("a stat with no value says why instead of working it out", () => {
  assert.deepEqual(explainStat("neededPerDay", context([], { today: "2026-11-05" }), en, "en"), {
    blocks: [], notes: ["This month has ended, so there are no days left to count."],
  });
  assert.deepEqual(explainStat("cashOnHand", context([]), es, "es").notes, ["Cuenta lo que tienes en Ajustes para empezar a seguirlo."]);
});

test("cash on hand works from its count, dated in the locale, with each kind of record since", () => {
  const parts = { countedCents: 346300, countedOn: "2026-10-07", incomeCents: 120000, purchasesCents: 0, billsCents: 80000, savingsCents: -20000, transfersCents: 0, cents: 406300 };
  const ctx = { ...context([]), cashOnHandCents: parts.cents, cashOnHandParts: parts };
  assert.deepEqual(explainStat("cashOnHand", ctx, es, "es").blocks[0].map((line) => [line.op, line.label]), [
    [undefined, "Contado el 7 oct"],
    ["+", "Ingresos desde entonces"],
    ["−", "Pagos y estados de cuenta pagados desde entonces"],
    ["+", "Sacado de ahorros desde entonces"],
    ["=", "Disponible"],
  ]);
});
