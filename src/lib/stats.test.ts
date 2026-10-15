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
    ref: "daysOff", label: "Days off left", value: { days: 11.1, tone: "gain", note: { text: "22 to break even", tone: "muted" } },
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
  // Over the finished days, Jul 1 to Oct 9 (101): Uber's 1,000 is 9.90 a day (the salary isn't pace), 600 everyday
  // spending 5.94. Balance 4,000 − 600 = 3,400, + 3,000 expected, + 22 days left × (9.90 − 5.94).
  assert.deepEqual(projected.value, { cents: 648712, tone: "gain", note: { text: "Goal $7,000.00 · $512.88 short", tone: "warning" } });
  assert.deepEqual(expected.value, { cents: 300000, note: { text: "1 payday left", tone: "muted" } });
  // The expected salary counts as coming: (7,000 − 6,400) ÷ 22 days + 5.94 a day, rounded up.
  assert.equal(needed.value?.cents, 3322);

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
      else if (line.op === "×") total *= figure;
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
    const averages: StatRef[] = ["averageSpending:day:all", "averageSpending:week:category.car", "averageSpending:month:item.pho"];
    const refs = [...availableStats(ctx, [{ id: "rideshare" }]), ...averages].filter((ref) => statShown(ref, ctx));
    assert.ok(refs.length >= 18);
    for (const ref of refs) {
      assertWorkingAddsUp(ref, ctx);
      assert.notEqual(statDescription(ref, ctx, en), "");
      assert.notEqual(statDescription(ref, ctx, es), "");
    }
  }
});

test("the balance's working shows income less what was paid out, then how far it is from the goal; savings never lower it", () => {
  const savings: LedgerData["savingsMovements"][number] = { id: "m1", fundId: "ef", date: dateFromKey("2026-10-05"), amountCents: 20000, note: null };
  const data: LedgerData = {
    categories: [food, car], purchases: [purchase("pho", "2026-10-04", 20000, food)], incomes: [income("u1", "2026-10-01", 100000, uber)],
    incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements: [], savingsMovements: [savings],
  };
  const summary = summarizeMonth(data, "2026-10");
  const ctx = monthStatContext({ view: { ...summary, purchases: data.purchases }, today: "2026-10-10", settings: { ...noSettings, balanceGoalCents: 90000 } });
  const working = explainStat("balance", ctx, en, "en");
  // 1,000 income − 200 pho = 800, the 200 moved into savings being kept, not spent; the 900 goal less 800 leaves 100.
  assert.deepEqual(working.blocks, [
    [
      { op: undefined, label: "Income", figure: { cents: 100000 } },
      { op: "−", label: "To pay", figure: { cents: 20000 } },
      { op: "=", label: "Balance", figure: { cents: 80000 } },
    ],
    [
      { op: undefined, label: "Goal", figure: { cents: 90000 } },
      { op: "−", label: "Balance", figure: { cents: 80000 } },
      { op: "=", label: "Still to go", figure: { cents: 10000 } },
    ],
  ]);
  assert.deepEqual(working.notes, ["Moving money into savings isn't spending, so it never lowers the balance."]);
  // To pay leaves savings out.
  assert.deepEqual(explainStat("toPay", ctx, en, "en").blocks[0].map((line) => [line.op, line.label, line.figure]), [
    [undefined, "Cash purchases", { cents: 20000 }],
    ["=", "To pay", { cents: 20000 }],
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
    ["+", "Everyday spending per day", { cents: 594 }],
    ["=", "Needed per day", { cents: 3322 }],
  ]);
  assert.deepEqual(working.notes, [
    "Without the goal, $0.00 a day covers the month.",
    "Everyday spending per day is your purchases in everyday categories over the last 101 finished days (today counts once it's over), divided by them. Recurring bills and installments of earlier purchases aren't included.",
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

test("daily income counts finished days, so income logged today waits until tomorrow", () => {
  // Oct 10: 1,000 on the 1st, and 3,000 logged today. Through yesterday, 9 days: 1,000 ÷ 9, and net of 600 everyday spending.
  const incomes = [income("u1", "2026-10-01", 100000, uber), income("u2", "2026-10-10", 300000, uber)];
  const [daily] = resolveStats(["dailyIncome"], context(incomes), en);
  assert.deepEqual(daily.value, { cents: 11111, tone: "gain", note: { text: "net $44.44", tone: "muted" } });
  assert.deepEqual(resolveStats(["dailyIncome"], context(incomes.slice(0, 1)), en)[0].value, daily.value);
  // Its working says so.
  const lines = explainStat("dailyIncome", context(incomes), en, "en").blocks[0].map((line) => line.label);
  assert.deepEqual(lines, ["Income through yesterday", "Days finished", "Daily income"]);
});

test("moving money into savings changes none of the month's figures or forecasts", () => {
  const incomes = [income("u1", "2026-10-01", 300000, uber), income("u2", "2026-10-05", 300000, uber)];
  const base: LedgerData = {
    categories: [food, car], purchases: [purchase("pho", "2026-10-04", 20000, food)], incomes,
    incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements: [], savingsMovements: [],
  };
  const saved: LedgerData = { ...base, savingsMovements: [{ id: "m1", fundId: "ef", date: dateFromKey("2026-10-08"), amountCents: 100000, note: null }] };
  const settings = { ...noSettings, balanceGoalCents: 400000 };
  const figures = (data: LedgerData) => {
    const ctx = monthStatContext({ view: { ...summarizeMonth(data, "2026-10"), purchases: data.purchases }, today: "2026-10-10", settings });
    return resolveStats(["balance", "toPay", "neededPerDay", "projectedBalance"], ctx, en).map((stat) => stat.value);
  };
  assert.deepEqual(figures(saved), figures(base));
});

test("savings adds up each fund and reads against the funds' goals", () => {
  const savings = {
    funds: [
      { kind: "EMERGENCY" as const, name: null, balanceCents: 300000, goalCents: 9000000 },
      { kind: "GOAL" as const, name: "Trip", balanceCents: 50000, goalCents: 200000 },
    ],
    emergency: { coverMonths: 3, emergencyCents: 8500000, installmentsOwedCents: 500000 },
  };
  const ctx = context([], { cashOnHandCents: null });
  const withSavings = { ...ctx, savings };
  assert.deepEqual(resolveStats(["savings"], withSavings, en)[0].value, { cents: 350000, tone: "gain", note: { text: "Goal $92,000.00 · $88,500.00 to go", tone: "muted" } });
  const working = explainStat("savings", withSavings, en, "en");
  assert.deepEqual(working.blocks.map((lines) => lines.map((line) => [line.op, line.label, line.figure])), [
    [[undefined, "Emergency fund", { cents: 300000 }], ["+", "Trip", { cents: 50000 }], ["=", "Savings", { cents: 350000 }]],
    [
      [undefined, "Average spending × 3 months", { cents: 8500000 }],
      ["+", "Installments owed", { cents: 500000 }],
      ["+", "Trip", { cents: 200000 }],
      ["=", "Goal", { cents: 9200000 }],
      ["−", "Savings", { cents: 350000 }],
      ["=", "Still to save", { cents: 8850000 }],
    ],
  ]);
  // Not loaded: no value, and no working.
  assert.equal(resolveStats(["savings"], ctx, en)[0].value, null);
  assert.deepEqual(explainStat("savings", ctx, en, "en").blocks, []);
});

test("an average spending stat is named by its settings, reads the usual against so far, and is checked when stored", () => {
  // History from Jul 1 through yesterday (Oct 9): 101 days; this week runs from Monday Oct 5.
  const ctx = context([], { today: "2026-10-10" });
  const [stat] = resolveStats(["averageSpending:week:category.car"], ctx, en);
  assert.equal(stat.label, "Car / week");
  assert.deepEqual(stat.value, { cents: Math.round(40000 / 101) * 7, note: { text: "This week: $0.00", tone: "muted" } });
  assert.equal(resolveStats(["averageSpending:month:item.pho"], ctx, es)[0].label, "pho / mes");
  // Today's spending past a usual day turns the note yellow.
  const today = context([], { today: "2026-10-04" });
  assert.equal(resolveStats(["averageSpending:day:all"], today, en)[0].value?.note?.tone, "warning");
  for (const ref of ["averageSpending:week:category.car", "averageSpending:day:all"]) assert.ok(isStatRef(ref));
  for (const ref of ["averageSpending", "averageSpending:", "averageSpending:year:all", "averageSpending:week:shop.x"]) assert.equal(isStatRef(ref), false);
  assert.deepEqual(availableStats(ctx, []).filter((ref) => ref.startsWith("averageSpending")), []);
});
