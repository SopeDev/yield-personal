import type { Locale } from "../i18n/config";
import { format, type Messages } from "../i18n/dictionaries";
import type { CashOnHandParts } from "./cash-on-hand";
import { categoryLabel } from "./categories";
import {
  blendWithEstimate, dailyNet, daysLeftIn, daysOff, DAYS_PER_MONTH, incomePace, neededPerDay, projectedBalance, todaySoFar, typicalDailySpending, type CategoryEstimate,
} from "./daily-balance";
import { formatShortDate } from "./dates";
import { incomePerPayday, neededPerPayday, type IncomeRhythm } from "./income-rhythm";
import type { LedgerIncome, LedgerIncomeGroup, LedgerPurchase } from "./ledger";
import { DEFAULT_CURRENCY, formatCents, type Currency } from "./money";
import type { MonthSummary } from "./month-summary";
import { dateFromKey, type MonthKey } from "./months";
import { expectedIncomeLeft, expectedPaydays, type RecurringIncomeDefinition } from "./recurring-income";
import {
  averageIncome, INCOME_FRAMES, INCOME_PERS, incomeBetween, incomeScopeParam, parseIncomeParam, parseIncomeScope,
  type IncomeBasis, type IncomeFrame, type IncomePer, type IncomeScope,
} from "./income-figures";
import {
  averageSpending, PERIOD_DAYS, parseSpendingParam, parseSpendingScope, periodStart, SPENDING_PERIODS, type SpendingPeriod, type SpendingScope,
} from "./spending-average";

/**
 * The stat library: every summary figure as a label, a calculation, how it reads (tone and a note below the
 * amount), and how it is explained (what it is, and how this month's figures add up to it). Summary cards are
 * layouts of stat references, so the same figure reads the same on any card.
 */

export type StatTone = "gain" | "loss" | "warning" | "muted";
export type StatNote = { text: string; tone: StatTone };
/** A figure ready to show (an amount, or a number of days), or null when it has no value this month (shown as "–"). */
export type StatValue = ({ cents: number; days?: never } | { days: number; cents?: never }) & { tone?: StatTone; note?: StatNote } | null;

/** How a line of a stat's working joins the lines above it, or "=" for what they come to. */
export type StatOp = "+" | "−" | "÷" | "×" | "=";
/** A figure in a stat's working: an amount, a number of days, or a number of paydays. */
export type StatFigure = { cents: number } | { days: number } | { paydays: number } | { months: number };
export type StatLine = { op?: StatOp; label: string; figure: StatFigure };
/**
 * How a stat is worked out this month, from the month's own figures: blocks of lines read top to bottom like a
 * receipt, each ending in what they come to, then notes on what goes into them. A stat with no value says why in a note.
 */
export type StatExplanation = { blocks: StatLine[][]; notes: string[] };

/** A month's totals in a currency other than the main one. */
export type OtherCurrencyTotals = { currency: string; incomeCents: number; spendingCents: number; toPayCents: number; outstandingCents: number };

/** Settings that shape month figures; the income rhythm defaults to daily. */
export type StatSettings = {
  balanceGoalCents: number | null;
  historyStartMonth: MonthKey | null;
  /** The day a new account started keeping records, counted from instead of its history start's first day. */
  historyFrom?: string | null;
  incomeRhythm?: IncomeRhythm;
  currency?: Currency;
  /** The setup wizard's estimates, standing in for typical spending and the pace of income while there's little history. */
  estimates?: Estimates;
};
export type Estimates = { spending: CategoryEstimate[]; incomeMonthlyCents: number };

/**
 * Savings in the main currency right now, fund by fund (funds in other currencies aren't converted into it): each
 * fund's balance and goal, the emergency fund's goal being months of average spending plus installments owed.
 */
export type SavingsSnapshot = {
  funds: { kind: "EMERGENCY" | "GOAL"; name: string | null; balanceCents: number; goalCents: number }[];
  /** How the emergency fund's goal adds up, when there is one. */
  emergency: { coverMonths: number; emergencyCents: number; installmentsOwedCents: number } | null;
};

/** Names of what configurable stats can be about (categories, items, income sources), archived ones included. */
export type StatNames = {
  categories: { id: string; key: string | null; name: string | null }[];
  items: { id: string; name: string }[];
  sources: { id: string; name: string }[];
};

/** A month's figures from which every stat is calculated, plus money on hand and savings, which are the same in every month. */
export function monthStatContext({ view, today, settings, cashOnHandCents = null, cashOnHandParts = null, otherCash = [], savings = null, incomeGroups = [], statNames = null }: {
  view: Pick<MonthSummary, "month" | "entries" | "occurrences" | "incomes" | "income" | "spending" | "cashFlow" | "savingsNetCents" | "balanceCents"> & {
    /** Recent purchases and incomes (back to the history window), for figures from past spending and work. */
    purchases: LedgerPurchase[];
    recentIncomes?: LedgerIncome[];
    /** Every income group with the categories it deducts, for net figures about a group. */
    incomeGroupDefs?: LedgerIncomeGroup[];
    /** Recurring income in the main currency, whose paydays not received yet are expected. */
    recurringIncomes?: RecurringIncomeDefinition[];
    /** Each other currency's totals this month, noted beside the main currency's (never added to them). */
    others?: OtherCurrencyTotals[];
  };
  /** Today as "YYYY-MM-DD". */
  today: string;
  settings: StatSettings;
  /** Money on hand now in the main currency's wallet (`loadCashOnHand`), or null when it isn't set or loaded. */
  cashOnHandCents?: number | null;
  /** How the main currency's money on hand got from its count to now, to explain it. */
  cashOnHandParts?: CashOnHandParts | null;
  /** Money on hand in wallets of other currencies, noted beside it. */
  otherCash?: { currency: string; cents: number }[];
  /** Savings now (`loadSavingsSnapshot`), or null when not loaded. */
  savings?: SavingsSnapshot | null;
  /** Income groups to name in group stats even in a month without their income, as the card editor lists them. */
  incomeGroups?: { id: string; name: string }[];
  /** For naming configurable stats; without them a name comes from the records, if any. */
  statNames?: StatNames | null;
}) {
  const { month, entries, incomes, income, cashFlow, balanceCents } = view;
  const goalCents = settings.balanceGoalCents;
  const rhythm = settings.incomeRhythm ?? { kind: "DAILY" };
  const dayNet = dailyNet({ month, today, entries, incomes });
  // Daily income compares with needed per day, so like the forecasts it counts finished days: a day under way would pull it down.
  const dayPace = dailyNet({ month, today, entries, incomes, finishedOnly: true });
  const historyStart = settings.historyFrom ?? settings.historyStartMonth;
  const estimates = settings.estimates ?? { spending: [], incomeMonthlyCents: 0 };
  const typicalDay = typicalDailySpending({ purchases: view.purchases, today, historyStart, estimates: estimates.spending });
  // Recurring income still expected this month counts as coming; it is no part of the pace of other income.
  const recurringIncomes = view.recurringIncomes ?? [];
  const paydays = expectedPaydays(recurringIncomes, incomes, month);
  const expected = expectedIncomeLeft(paydays);
  const recurringSourceIds = new Set(recurringIncomes.map((recurring) => recurring.source.id));
  const paceIncomes = (view.recentIncomes ?? incomes).filter((item) => !item.recurringIncomeId && !recurringSourceIds.has(item.source.id));
  const pace = incomePace({ incomes: paceIncomes, today, historyStart, estimateMonthlyCents: estimates.incomeMonthlyCents });
  const needed = neededPerDay({
    month, today, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents + expected.cents, goalCents, typicalDailyCents: typicalDay.cents,
  });
  // The categories income groups deduct are the costs of working, spent only on days worked.
  const workCategoryIds = income.deductCategoryIds;
  const livingDay = typicalDailySpending({ purchases: view.purchases, today, historyStart, excludeCategoryIds: workCategoryIds, estimates: estimates.spending });
  // What today has already brought in (the pace's kind of income) and spent; forecasts add only the rest of an average day.
  const todayRecords = todaySoFar({ purchases: view.purchases, incomes: paceIncomes, today });
  return {
    ...view,
    today,
    currency: settings.currency ?? DEFAULT_CURRENCY,
    others: view.others ?? [],
    cashOnHandCents,
    cashOnHandParts,
    otherCash,
    savings,
    incomeGroups,
    statNames,
    incomeGroupDefs: view.incomeGroupDefs ?? [],
    historyFrom: historyStart,
    estimates,
    goalCents,
    rhythm,
    dayNet,
    dayPace,
    typicalDay,
    livingDay,
    pace,
    needed,
    neededPayday: neededPerPayday({
      month, today, rhythm, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents, goalCents, typicalDailyCents: typicalDay.cents,
    }),
    daysOff: daysOff({
      month, today, historyStart, purchases: view.purchases, incomes: paceIncomes,
      workCategoryIds, livingDailyCents: livingDay.cents,
      toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents + expected.cents, goalCents,
    }),
    paydays,
    expected,
    projected: projectedBalance({
      month, today, balanceCents, expectedCents: expected.cents, typicalDailyCents: typicalDay.cents, paceDailyCents: pace.cents,
      todayIncomeCents: todayRecords.incomeCents, todaySpentCents: todayRecords.spentCents,
    }),
    paydayIncome: dayNet ? incomePerPayday({ month, today, rhythm, incomeCents: dayNet.incomeCents, everydaySpendingCents: dayNet.spendingCents }) : null,
    // The day's target is the goal's when one is set; average daily income is gross, like the target.
    targetCents: needed ? (needed.forGoalCents ?? needed.cents) : null,
    dailyIncomeCents: dayPace ? Math.round(dayPace.incomeCents / dayPace.days) : null,
    goalLeftCents: goalCents === null ? 0 : goalCents - balanceCents,
  };
}

export type StatContext = ReturnType<typeof monthStatContext>;

/** What explaining a stat needs besides its context: its label (the result its working comes to) and the locale for dates. */
type ExplainOptions = { label: string; locale: Locale };

type StatDefinition = {
  label: (context: StatContext, messages: Messages, param: string) => string;
  /** Whether the stat appears this month at all; a hidden stat leaves no cell behind. Shown by default. */
  shown?: (context: StatContext, param: string) => boolean;
  value: (context: StatContext, messages: Messages, param: string) => StatValue;
  /** What the stat is, in a sentence. */
  description: (context: StatContext, messages: Messages, param: string) => string;
  /** How this month's figures come to the stat's value. */
  explain: (context: StatContext, messages: Messages, param: string, options: ExplainOptions) => StatExplanation;
};

/** A value with a note below it, leaving the note out entirely when there is none. */
function withNote(value: Exclude<StatValue, null>, note: StatNote | undefined): StatValue {
  return note ? { ...value, note } : value;
}

/** "+ US$120.00" for each other currency with an amount of this kind this month, or none. */
function othersNote(others: OtherCurrencyTotals[], field: Exclude<keyof OtherCurrencyTotals, "currency">): StatNote | undefined {
  const parts = others.filter((other) => other[field] !== 0).map((other) => `+ ${formatCents(other[field], other.currency, true)}`);
  return parts.length > 0 ? { text: parts.join(" · "), tone: "muted" } : undefined;
}

const signTone = (cents: number): StatTone => (cents < 0 ? "loss" : "gain");
const zeroIsGain = (cents: number): StatTone | undefined => (cents === 0 ? "gain" : undefined);
const groupOf = (context: StatContext, groupId: string) => context.income.byGroup.find((entry) => entry.group.id === groupId);
const groupName = (context: StatContext, groupId: string) =>
  groupOf(context, groupId)?.group.name ?? context.incomeGroups.find((group) => group.id === groupId)?.name
  ?? context.incomeGroupDefs.find((group) => group.id === groupId)?.name ?? "";
const notDaily = (context: StatContext) => context.rhythm.kind !== "DAILY";
const hasDeductions = (context: StatContext) => context.income.deductCategoryIds.length > 0;
// A group's figures differ from the totals only when there is income outside it too.
const groupShown = (context: StatContext, groupId: string) => {
  const group = groupOf(context, groupId);
  return group !== undefined && group.grossCents < context.income.totalCents;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/* Building a stat's working. */

const amount = (label: string, cents: number, op?: StatOp): StatLine => ({ op, label, figure: { cents } });
const dayCount = (label: string, days: number, op?: StatOp): StatLine => ({ op, label, figure: { days } });
/** An amount shown only when it isn't zero. */
const unlessZero = (label: string, cents: number, op: StatOp) => (cents === 0 ? null : amount(label, cents, op));
/** An amount worded by its sign, like money moved into savings or taken out: `op` joins it when positive, the other way when negative. */
function bySign(cents: number, op: "+" | "−", positive: string, negative: string) {
  if (cents === 0) return null;
  return cents > 0 ? amount(positive, cents, op) : amount(negative, -cents, op === "+" ? "−" : "+");
}
/** A block of the lines not left out; the first starts the working, so it joins nothing. */
function block(...lines: (StatLine | null)[]): StatLine[] {
  return lines.filter((line) => line !== null).map((line, index) => (index === 0 ? { ...line, op: undefined } : line));
}
function explained(blocks: StatLine[][], notes: (string | null | false)[] = []): StatExplanation {
  return { blocks, notes: notes.filter((note) => typeof note === "string") };
}
const why = (...notes: (string | null | false)[]) => explained([], notes);

const daysText = (days: number, messages: Messages) => (days === 1 ? messages.month.dayCountOne : format(messages.month.dayCount, { count: days }));

/** That amounts in other currencies are left out of this figure, naming them, or nothing when there are none. */
function otherCurrenciesNote(others: OtherCurrencyTotals[], field: Exclude<keyof OtherCurrencyTotals, "currency">, messages: Messages) {
  const note = othersNote(others, field);
  return note ? format(messages.explain.otherCurrencies, { amounts: note.text }) : null;
}

const everydayNote = ({ typicalDay, currency }: StatContext, messages: Messages) => [
  format(messages.explain.everydayNote, { days: typicalDay.days }),
  typicalDay.estimateShare > 0 ? format(messages.explain.estimateNote, {
    percent: Math.round(typicalDay.estimateShare * 100), amount: formatCents(typicalDay.estimateMonthlyCents, currency), real: formatCents(typicalDay.realCents, currency),
  }) : null,
].filter(Boolean).join(" ");
const paceEstimateNote = ({ pace, currency }: StatContext, messages: Messages) => (pace.estimateShare > 0 ? format(messages.explain.paceEstimateNote, {
  percent: Math.round(pace.estimateShare * 100), amount: formatCents(pace.estimateMonthlyCents, currency), real: formatCents(pace.realCents, currency),
}) : null);

/**
 * What income still has to cover this month: its total to pay less its income (and, `withExpected`, recurring income
 * still expected), or with a goal, what still reaches the goal.
 */
function shortfall(context: StatContext, messages: Messages, { withExpected }: { withExpected: boolean }) {
  const { goalCents, cashFlow, income, expected } = context;
  const expectedCents = withExpected ? expected.cents : 0;
  const breakEvenCents = cashFlow.toPayCents - income.totalCents - expectedCents;
  const cents = goalCents === null ? breakEvenCents : goalCents + breakEvenCents;
  return {
    cents,
    lines: [
      goalCents === null ? null : amount(messages.explain.goal, goalCents),
      amount(messages.month.toPay, cashFlow.toPayCents, "+"),
      amount(messages.month.income, income.totalCents, "−"),
      unlessZero(messages.month.expectedIncome, expectedCents, "−"),
      amount(messages.explain.stillToCover, cents, "="),
    ],
  };
}

/** The month's income source by source, coming to `label`. */
function incomeExplanation({ income, others }: StatContext, messages: Messages, label: string) {
  if (income.totalCents === 0) return why(messages.explain.noIncome, otherCurrenciesNote(others, "incomeCents", messages));
  return explained(
    [block(...income.bySource.map(({ source, totalCents }) => amount(source.name, totalCents, "+")), amount(label, income.totalCents, "="))],
    [otherCurrenciesNote(others, "incomeCents", messages)],
  );
}

/** The deducted categories with their spending this month. */
function deductedCategories({ spending }: StatContext, categoryIds: string[]) {
  return categoryIds.flatMap((id) => spending.byCategory.filter((entry) => entry.category.id === id));
}

function deductionsLabel(context: StatContext, messages: Messages) {
  const categories = deductedCategories(context, context.income.deductCategoryIds);
  return categories.length === 1 ? format(messages.income.categorySpending, { category: categoryLabel(categories[0].category, messages.categories) }) : messages.income.deductions;
}

/** What an average spending stat is about, by name: everyday spending, a category, or an item. */
function scopeName(context: StatContext, messages: Messages, scope: SpendingScope) {
  if (scope.kind === "all") return messages.summary.everydaySpending;
  if (scope.kind === "category") {
    const category = context.statNames?.categories.find((entry) => entry.id === scope.id)
      ?? context.purchases.find((purchase) => purchase.item.category.id === scope.id)?.item.category;
    return category ? categoryLabel(category, messages.categories) : "–";
  }
  return context.statNames?.items.find((entry) => entry.id === scope.id)?.name
    ?? context.purchases.find((purchase) => purchase.item.id === scope.id)?.item.name ?? "–";
}

const periodName = (period: SpendingPeriod, messages: Messages) => messages.summary.periods[period];

function spendingOn(context: StatContext, param: string) {
  const parsed = parseSpendingParam(param);
  if (!parsed) return null;
  const figures = averageSpending({ purchases: context.purchases, today: context.today, historyStart: context.historyFrom, ...parsed });
  const { scope } = parsed;
  const estimateCents = scope.kind === "item" ? 0 : sum(context.estimates.spending.filter((estimate) => scope.kind === "all" || estimate.categoryId === scope.id).map((estimate) => estimate.monthlyCents));
  return { ...parsed, ...withEstimate(figures, PERIOD_DAYS[parsed.period], estimateCents) };
}

/**
 * An average's figures with a monthly estimate blended into its day while there's little history (`blendWithEstimate`):
 * the per-day figure and the average from it, and the blend to explain them.
 */
function withEstimate<F extends { totalCents: number; days: number; perDayCents: number; averageCents: number }>(figures: F, periodDays: number, estimateMonthlyCents: number) {
  const blend = blendWithEstimate(figures.days < 1 ? 0 : figures.totalCents / figures.days, figures.days, estimateMonthlyCents);
  if (blend.estimateShare === 0) return { figures, blend: null };
  return { figures: { ...figures, perDayCents: blend.cents, averageCents: Math.round(blend.cents * periodDays) }, blend };
}

/** How a day partly made of the estimate adds up: what the records make it and what the estimate does, each in its share. */
function blendBlock(blend: NonNullable<ReturnType<typeof withEstimate>["blend"]>, label: string, messages: Messages, currency: string) {
  const estimateShare = Math.round(blend.estimateShare * 100);
  return block(
    amount(format(messages.explain.fromRecords, { percent: 100 - estimateShare }), Math.round(blend.realCents * (1 - blend.estimateShare))),
    amount(
      format(messages.explain.fromEstimate, { percent: estimateShare, amount: formatCents(blend.estimateMonthlyCents, currency) }),
      Math.round((blend.estimateMonthlyCents / DAYS_PER_MONTH) * blend.estimateShare),
      "+",
    ),
    amount(label, blend.cents, "="),
  );
}

/** The categories whose spending comes off an income scope's net: every group's, the group's, or none for one source. */
function deductIdsFor(context: StatContext, scope: IncomeScope) {
  if (scope.kind === "all") return context.income.deductCategoryIds;
  if (scope.kind === "source") return [];
  return (context.incomeGroupDefs.find((group) => group.id === scope.id) ?? groupOf(context, scope.id)?.group)?.deductCategoryIds ?? [];
}

const inIncomeScope = (scope: IncomeScope) => (income: Pick<LedgerIncome, "source">) =>
  scope.kind === "all" || (scope.kind === "group" ? income.source.groupId === scope.id : income.source.id === scope.id);

/** What an income stat is about, by name: "Income" or "Net income", "Rideshare gross" or "Rideshare net", or a source. */
function incomeScopeName(context: StatContext, messages: Messages, scope: IncomeScope, basis: IncomeBasis) {
  if (scope.kind === "all") return basis === "net" ? messages.summary.netIncome : messages.month.income;
  if (scope.kind === "group") return format(basis === "net" ? messages.income.groupNet : messages.income.groupGross, { group: groupName(context, scope.id) || "–" });
  return context.statNames?.sources.find((source) => source.id === scope.id)?.name
    ?? [...(context.recentIncomes ?? []), ...context.incomes].find((income) => income.source.id === scope.id)?.source.name ?? "–";
}

/**
 * An income stat's figures: for the month, its income (net of its deducted categories' spending this month); today
 * or this week, only in the current month, its income less the deducted categories' purchases since the period began.
 */
function incomeOfFigures(context: StatContext, param: string) {
  const parsed = parseIncomeParam(param, INCOME_FRAMES);
  if (!parsed) return null;
  const { step: frame, scope, basis } = parsed;
  const deductCategoryIds = basis === "net" ? deductIdsFor(context, scope) : [];
  if (frame === "month") {
    const sources = context.income.bySource.filter(({ source }) => inIncomeScope(scope)({ source }));
    const grossCents = sum(sources.map((entry) => entry.totalCents));
    const deducted = deductedCategories(context, deductCategoryIds);
    const deductionsCents = sum(deducted.map((entry) => entry.totalCents));
    return { ...parsed, frame, fromKey: null, sources, deducted, grossCents, deductionsCents, cents: grossCents - deductionsCents };
  }
  if (context.month !== context.today.slice(0, 7)) return { ...parsed, frame, unavailable: true as const };
  const fromKey = periodStart(context.today, frame);
  const figures = incomeBetween(
    { incomes: context.recentIncomes ?? context.incomes, purchases: context.purchases, scope, basis, deductCategoryIds },
    fromKey,
    context.today,
  );
  return { ...parsed, frame, fromKey, sources: null, deducted: null, ...figures };
}

function averageIncomeFigures(context: StatContext, param: string) {
  const parsed = parseIncomeParam(param, INCOME_PERS);
  if (!parsed) return null;
  const { step: per, scope, basis } = parsed;
  return {
    ...parsed,
    per,
    figures: averageIncome({
      incomes: context.recentIncomes ?? context.incomes, purchases: context.purchases, scope, basis,
      deductCategoryIds: basis === "net" ? deductIdsFor(context, scope) : [],
      today: context.today, historyStart: context.historyFrom, per,
    }),
  };
}

const perName = (per: IncomePer, messages: Messages) => (per === "workday" ? messages.summary.workday : messages.summary.periods[per]);

const STATS = {
  /** As in the spreadsheet: income minus everything paid out this month, with progress toward the balance goal. */
  balance: {
    label: (_, messages) => messages.month.balance,
    value: ({ balanceCents, goalCents, goalLeftCents, needed, currency }, messages) => {
      const goal = goalCents === null ? null : formatCents(goalCents, currency);
      // A month that has ended either met the goal or missed it.
      const note: StatNote | undefined = goal === null ? undefined
        : goalLeftCents <= 0 ? { text: format(messages.month.goalReached, { goal }), tone: "gain" }
          : needed ? { text: format(messages.month.goalToGo, { goal, amount: formatCents(goalLeftCents, currency) }), tone: "muted" }
            : { text: format(messages.month.goalMissed, { goal, amount: formatCents(goalLeftCents, currency) }), tone: "loss" };
      return { cents: balanceCents, tone: signTone(balanceCents), note };
    },
    description: (_, messages) => messages.explain.aboutBalance,
    explain: ({ income, cashFlow, balanceCents, goalCents, goalLeftCents }, messages, _, { label }) => {
      const balance = block(amount(messages.month.income, income.totalCents), amount(messages.month.toPay, cashFlow.toPayCents, "−"), amount(label, balanceCents, "="));
      if (goalCents === null) return explained([balance], [messages.explain.noGoal]);
      const goal = block(
        amount(messages.explain.goal, goalCents),
        amount(label, balanceCents, "−"),
        goalLeftCents > 0 ? amount(messages.explain.stillToGo, goalLeftCents, "=") : amount(messages.explain.overGoal, -goalLeftCents, "="),
      );
      return explained([balance, goal], [messages.explain.goalSavings]);
    },
  },
  /** Everything received this month, with the number of days that had any. */
  income: {
    label: (_, messages) => messages.month.income,
    value: ({ income, others }, messages) => {
      const days = income.daysWithIncome === 0 ? null
        : income.daysWithIncome === 1 ? messages.income.daysWithIncomeOne : format(messages.income.daysWithIncome, { count: income.daysWithIncome });
      const text = [othersNote(others, "incomeCents")?.text ?? null, days].filter(Boolean).join(" · ");
      return withNote({ cents: income.totalCents }, text ? { text, tone: "muted" } : undefined);
    },
    description: (_, messages) => messages.explain.aboutTotalIncome,
    explain: (context, messages, _, { label }) => incomeExplanation(context, messages, label),
  },
  spending: {
    label: (_, messages) => messages.month.spending,
    value: ({ spending, others }) => withNote({ cents: spending.totalCents }, othersNote(others, "spendingCents")),
    description: (_, messages) => messages.explain.aboutSpending,
    explain: ({ entries, occurrences, spending, others }, messages, _, { label }) => explained(
      [block(
        amount(messages.explain.purchases, sum(entries.filter((entry) => entry.installmentNumber === 1).map((entry) => entry.amountCents))),
        unlessZero(messages.explain.installments, sum(entries.filter((entry) => entry.installmentNumber > 1).map((entry) => entry.amountCents)), "+"),
        unlessZero(messages.explain.recurringBills, sum(occurrences.map((occurrence) => occurrence.amountCents)), "+"),
        amount(label, spending.totalCents, "="),
      )],
      [messages.explain.spendingCards, otherCurrenciesNote(others, "spendingCents", messages)],
    ),
  },
  toPay: {
    label: (_, messages) => messages.month.toPay,
    value: ({ cashFlow, others }) => withNote({ cents: cashFlow.toPayCents }, othersNote(others, "toPayCents")),
    description: (_, messages) => messages.explain.aboutToPay,
    explain: ({ cashFlow, others }, messages, _, { label }) => explained(
      [block(
        amount(messages.explain.cashPurchases, cashFlow.cashPurchasesCents),
        unlessZero(messages.explain.cashBills, cashFlow.cashBillsCents, "+"),
        unlessZero(messages.explain.statementsClosing, cashFlow.statementsClosingCents, "+"),
        amount(label, cashFlow.toPayCents, "="),
      )],
      [messages.explain.toPayCards, otherCurrenciesNote(others, "toPayCents", messages)],
    ),
  },
  /** Unpaid bills and statements, noting what was carried from earlier months. */
  outstanding: {
    label: (_, messages) => messages.month.outstanding,
    value: ({ cashFlow, currency, others }, messages) => ({
      cents: cashFlow.outstandingCents,
      tone: cashFlow.outstandingCents > 0 ? "warning" : undefined,
      note: cashFlow.carriedOutstandingCents > 0
        ? { text: format(messages.month.includesCarried, { amount: formatCents(cashFlow.carriedOutstandingCents, currency) }), tone: "loss" }
        : othersNote(others, "outstandingCents"),
    }),
    description: (_, messages) => messages.explain.aboutOutstanding,
    explain: ({ cashFlow, others }, messages, _, { label }) => {
      const { unpaidOccurrences, unpaidStatements, outstandingCents, carriedOutstandingCents } = cashFlow;
      const carried = carriedOutstandingCents > 0 ? [block(amount(messages.month.carriedTitle, carriedOutstandingCents))] : [];
      const notes = [carriedOutstandingCents > 0 && messages.explain.carried, otherCurrenciesNote(others, "outstandingCents", messages)];
      if (outstandingCents === 0) return explained(carried, [messages.month.outstandingEmpty, ...notes]);
      return explained([
        block(
          unpaidOccurrences.length === 0 ? null
            : amount(format(messages.explain.unpaidBills, { count: unpaidOccurrences.length }), sum(unpaidOccurrences.map((occurrence) => occurrence.amountCents)), "+"),
          unpaidStatements.length === 0 ? null
            : amount(format(messages.explain.unpaidStatements, { count: unpaidStatements.length }), sum(unpaidStatements.map((statement) => statement.totalCents)), "+"),
          amount(label, outstandingCents, "="),
        ),
        ...carried,
      ], notes);
    },
  },
  /** Income needed per remaining day; with a goal, the goal's daily target leads and breaking even is noted below. */
  neededPerDay: {
    label: (_, messages) => messages.month.neededPerDay,
    value: ({ needed, currency }, messages) => {
      if (!needed) return null;
      if (needed.forGoalCents !== null) {
        return { cents: needed.forGoalCents, tone: zeroIsGain(needed.forGoalCents), note: { text: format(messages.month.breakEven, { amount: formatCents(needed.cents, currency) }), tone: "muted" } };
      }
      return {
        cents: needed.cents,
        tone: zeroIsGain(needed.cents),
        note: needed.typicalDailyCents > 0 ? { text: format(messages.month.inclEveryday, { amount: formatCents(needed.typicalDailyCents, currency) }), tone: "muted" } : undefined,
      };
    },
    description: ({ goalCents }, messages) => (goalCents === null ? messages.explain.aboutNeededPerDay : messages.explain.aboutNeededPerDayGoal),
    explain: (context, messages, _, { label }) => {
      const { needed, currency } = context;
      if (!needed) return why(messages.explain.monthEnded);
      const result = needed.forGoalCents ?? needed.cents;
      return explained(
        [block(
          ...shortfall(context, messages, { withExpected: true }).lines,
          dayCount(messages.explain.daysLeft, needed.daysLeft, "÷"),
          amount(messages.explain.everydayPerDay, needed.typicalDailyCents, "+"),
          amount(label, result, "="),
        )],
        [
          result === 0 && messages.explain.covered,
          needed.forGoalCents !== null && format(messages.explain.breakEvenPerDay, { amount: formatCents(needed.cents, currency) }),
          everydayNote(context, messages),
        ],
      );
    },
  },
  /** Gross income per finished day, against the day's target, with daily net below. */
  dailyIncome: {
    label: (_, messages) => messages.month.dailyIncome,
    value: ({ dayPace, dailyIncomeCents, targetCents, currency }, messages) => {
      if (!dayPace || dailyIncomeCents === null) return null;
      return {
        cents: dailyIncomeCents,
        tone: targetCents === null ? undefined : dailyIncomeCents >= targetCents ? "gain" : "warning",
        note: { text: format(messages.month.netPerDay, { amount: formatCents(dayPace.averageCents, currency) }), tone: "muted" },
      };
    },
    description: (_, messages) => messages.explain.aboutDailyIncome,
    explain: ({ dayPace, dailyIncomeCents, targetCents, currency }, messages, _, { label }) => {
      if (!dayPace || dailyIncomeCents === null) return why(messages.explain.monthAhead);
      const finished = dayPace.throughYesterday;
      const incomeSoFar = amount(finished ? messages.explain.incomeThroughYesterday : messages.explain.incomeSoFar, dayPace.incomeCents);
      const daysSoFar = dayCount(finished ? messages.explain.daysFinished : messages.explain.daysSoFar, dayPace.days, "÷");
      const everyday = finished ? messages.explain.everydayThroughYesterday : messages.explain.everydaySoFar;
      return explained(
        [
          block(incomeSoFar, daysSoFar, amount(label, dailyIncomeCents, "=")),
          block(incomeSoFar, amount(everyday, dayPace.spendingCents, "−"), daysSoFar, amount(messages.explain.netPerDay, dayPace.averageCents, "=")),
        ],
        [targetCents !== null && format(messages.explain.dailyTarget, { amount: formatCents(targetCents, currency) }), messages.explain.everydaySoFarNote],
      );
    },
  },
  /**
   * Days off left this month at the recent pace of work (daily income only); with a goal, the goal's days lead and
   * breaking even is noted below.
   */
  daysOff: {
    label: (_, messages) => messages.month.daysOff,
    shown: (context) => !notDaily(context),
    value: ({ daysOff }, messages) => {
      if (!daysOff) return null;
      const tone = (days: number): StatTone => (days === 0 ? "warning" : "gain");
      if (daysOff.forGoalDays !== null) {
        return { days: daysOff.forGoalDays, tone: tone(daysOff.forGoalDays), note: { text: format(messages.month.daysOffBreakEven, { count: daysOff.days }), tone: "muted" } };
      }
      return { days: daysOff.days, tone: tone(daysOff.days), note: { text: format(messages.month.daysOffOf, { count: daysOff.freeDays }), tone: "muted" } };
    },
    description: ({ goalCents }, messages) => (goalCents === null ? messages.explain.aboutDaysOff : messages.explain.aboutDaysOffGoal),
    explain: (context, messages, _, { label }) => {
      const { daysOff, livingDay, typicalDay, month, today, currency } = context;
      if (!daysOff) return why(month === today.slice(0, 7) ? format(messages.explain.daysOffNoPace, { days: typicalDay.days }) : messages.explain.currentMonthOnly);
      const { daysLeft, freeDays } = daysOff;
      const workDaysNeeded = daysOff.forGoalWorkDaysNeeded ?? daysOff.workDaysNeeded;
      const toCover = shortfall(context, messages, { withExpected: true });
      const living = format(messages.explain.livingForDaysLeft, { amount: formatCents(livingDay.cents, currency), days: daysText(daysLeft - 1, messages) });
      return explained(
        [
          block(
            ...toCover.lines,
            unlessZero(messages.explain.restOfTodayLiving, daysOff.livingTodayLeftCents, "+"),
            unlessZero(living, livingDay.cents * (daysLeft - 1), "+"),
            amount(messages.explain.neededFromWork, toCover.cents + daysOff.livingCents, "="),
            amount(messages.explain.netPerWorkDay, daysOff.netPerWorkDayCents, "÷"),
            dayCount(messages.explain.workDaysNeeded, workDaysNeeded, "="),
          ),
          block(
            dayCount(daysOff.workedToday ? messages.explain.daysLeftAfterToday : messages.explain.daysLeft, freeDays),
            dayCount(messages.explain.workDaysNeeded, workDaysNeeded, "−"),
            dayCount(label, daysOff.forGoalDays ?? daysOff.days, "="),
          ),
        ],
        [
          daysOff.workedToday && messages.explain.workedTodayNote,
          workDaysNeeded > freeDays && messages.explain.moreWorkThanDays,
          daysOff.forGoalDays !== null && format(messages.explain.daysOffBreakEvenNote, { count: daysOff.days }),
          format(messages.explain.daysOffPace, { workDays: daysOff.workDays, days: typicalDay.days, amount: formatCents(daysOff.netPerWorkDayCents, currency) }),
          messages.explain.livingNote,
        ],
      );
    },
  },
  /**
   * The balance the month is headed for: recurring income still expected, and the recent pace of other income minus
   * typical daily spending for each day left. With a goal, how far above or below it lands is noted below.
   */
  projectedBalance: {
    label: (_, messages) => messages.month.projectedBalance,
    shown: (context) => context.projected !== null,
    value: ({ projected, expected, goalCents, currency }, messages) => {
      if (!projected) return null;
      let note: StatNote | undefined;
      if (goalCents !== null) {
        const overCents = projected.cents - goalCents;
        const values = { goal: formatCents(goalCents, currency), amount: formatCents(Math.abs(overCents), currency) };
        note = overCents >= 0 ? { text: format(messages.month.projectedGoalOver, values), tone: "gain" } : { text: format(messages.month.projectedGoalShort, values), tone: "warning" };
      } else if (expected.cents > 0) {
        note = { text: format(messages.month.inclExpected, { amount: formatCents(expected.cents, currency) }), tone: "muted" };
      }
      return withNote({ cents: projected.cents, tone: signTone(projected.cents) }, note);
    },
    description: (_, messages) => messages.explain.aboutProjectedBalance,
    explain: (context, messages, _, { label }) => {
      const { projected, balanceCents, expected, pace, typicalDay, goalCents, currency } = context;
      if (!projected) return why(messages.explain.monthEnded);
      const days = daysText(projected.daysAfterToday, messages);
      const hasToday = projected.daysAfterToday < projected.daysLeft;
      return explained(
        [block(
          amount(messages.month.balance, balanceCents),
          unlessZero(messages.month.expectedIncome, expected.cents, "+"),
          unlessZero(messages.explain.restOfTodayIncome, projected.todayIncomeLeftCents, "+"),
          unlessZero(format(messages.explain.paceForDaysLeft, { amount: formatCents(pace.cents, currency), days }), pace.cents * projected.daysAfterToday, "+"),
          unlessZero(messages.explain.restOfTodaySpending, projected.todaySpendingLeftCents, "−"),
          unlessZero(format(messages.explain.everydayForDaysLeft, { amount: formatCents(typicalDay.cents, currency), days }), typicalDay.cents * projected.daysAfterToday, "−"),
          amount(label, projected.cents, "="),
        )],
        [
          hasToday && messages.explain.restOfTodayNote,
          format(messages.explain.paceNote, { days: pace.days }),
          paceEstimateNote(context, messages),
          everydayNote(context, messages),
          goalCents !== null && messages.explain.goalSavings,
        ],
      );
    },
  },
  /** Recurring income not received yet this month (shown while the month has paydays of it and hasn't ended). */
  expectedIncome: {
    label: (_, messages) => messages.month.expectedIncome,
    shown: (context) => context.projected !== null && context.expected.paydays > 0,
    value: ({ expected }, messages) => (expected.paydaysLeft === 0 ? { cents: 0, tone: "gain", note: { text: messages.month.allReceived, tone: "gain" } } : {
      cents: expected.cents,
      note: { text: expected.paydaysLeft === 1 ? messages.month.paydaysLeftOne : format(messages.month.paydaysLeft, { count: expected.paydaysLeft }), tone: "muted" },
    }),
    description: (_, messages) => messages.explain.aboutExpectedIncome,
    explain: ({ paydays, expected }, messages, _, { label, locale }) => {
      const left = paydays.filter((payday) => payday.received === null);
      if (left.length === 0) return why(messages.month.allReceived);
      return explained(
        [block(
          ...left.map(({ recurring, date }) => amount(format(messages.explain.payday, { source: recurring.source.name, date: formatShortDate(dateFromKey(date), locale) }), recurring.amountCents, "+")),
          amount(label, expected.cents, "="),
        )],
        [messages.explain.expectedNote],
      );
    },
  },
  /**
   * Income needed per payday left, following the income rhythm (hidden with a daily rhythm, where it is needed per
   * day); with a goal, the goal's target leads and breaking even is noted below.
   */
  neededPerPayday: {
    label: (_, messages) => messages.month.neededPerPayday,
    shown: notDaily,
    value: ({ neededPayday, currency }, messages) => {
      if (!neededPayday) return null;
      const { paydaysLeft } = neededPayday;
      const left: StatNote = paydaysLeft === 0 ? { text: messages.month.noPaydaysLeft, tone: "warning" }
        : { text: paydaysLeft === 1 ? messages.month.paydaysLeftOne : format(messages.month.paydaysLeft, { count: paydaysLeft }), tone: "muted" };
      if (neededPayday.forGoalCents !== null) {
        return {
          cents: neededPayday.forGoalCents,
          tone: zeroIsGain(neededPayday.forGoalCents),
          note: paydaysLeft === 0 ? left : { text: format(messages.month.breakEven, { amount: formatCents(neededPayday.cents, currency) }), tone: "muted" },
        };
      }
      return { cents: neededPayday.cents, tone: zeroIsGain(neededPayday.cents), note: left };
    },
    description: ({ goalCents }, messages) => (goalCents === null ? messages.explain.aboutNeededPerPayday : messages.explain.aboutNeededPerPaydayGoal),
    explain: (context, messages, _, { label }) => {
      const { neededPayday, typicalDay, month, today, currency } = context;
      const daysLeft = daysLeftIn(month, today);
      if (!neededPayday || daysLeft === null) return why(messages.explain.monthEnded);
      const toCover = shortfall(context, messages, { withExpected: false });
      const comingCents = typicalDay.cents * daysLeft;
      const result = neededPayday.forGoalCents ?? neededPayday.cents;
      const coming = format(messages.explain.everydayForDaysLeft, { amount: formatCents(typicalDay.cents, currency), days: daysText(daysLeft, messages) });
      return explained(
        [block(
          ...toCover.lines,
          amount(coming, comingCents, "+"),
          amount(messages.explain.neededByMonthEnd, toCover.cents + comingCents, "="),
          neededPayday.paydaysLeft === 0 ? null : { op: "÷", label: messages.explain.paydaysLeft, figure: { paydays: neededPayday.paydaysLeft } },
          amount(label, result, "="),
        )],
        [
          neededPayday.paydaysLeft === 0 && messages.explain.noPaydaysLeft,
          result === 0 && messages.explain.covered,
          neededPayday.forGoalCents !== null && format(messages.explain.breakEvenPerPayday, { amount: formatCents(neededPayday.cents, currency) }),
          messages.explain.rhythmNote,
          everydayNote(context, messages),
        ],
      );
    },
  },
  /** Gross income per payday passed, against the payday target, with net below (hidden with a daily rhythm). */
  incomePerPayday: {
    label: (_, messages) => messages.month.incomePerPayday,
    shown: notDaily,
    value: ({ paydayIncome, neededPayday, currency }, messages) => {
      if (!paydayIncome) return null;
      const targetCents = neededPayday ? (neededPayday.forGoalCents ?? neededPayday.cents) : null;
      return {
        cents: paydayIncome.grossCents,
        tone: targetCents === null ? undefined : paydayIncome.grossCents >= targetCents ? "gain" : "warning",
        note: { text: format(messages.month.netPerDay, { amount: formatCents(paydayIncome.netCents, currency) }), tone: "muted" },
      };
    },
    description: (_, messages) => messages.explain.aboutIncomePerPayday,
    explain: ({ paydayIncome, dayNet, neededPayday, currency }, messages, _, { label }) => {
      if (!paydayIncome || !dayNet) return why(messages.explain.beforeFirstPayday, messages.explain.rhythmNote);
      const incomeSoFar = amount(messages.explain.incomeSoFar, dayNet.incomeCents);
      const paydaysSoFar: StatLine = { op: "÷", label: messages.explain.paydaysSoFar, figure: { paydays: paydayIncome.paydaysPassed } };
      const targetCents = neededPayday ? (neededPayday.forGoalCents ?? neededPayday.cents) : null;
      return explained(
        [
          block(incomeSoFar, paydaysSoFar, amount(label, paydayIncome.grossCents, "=")),
          block(incomeSoFar, amount(messages.explain.everydaySoFar, dayNet.spendingCents, "−"), paydaysSoFar, amount(messages.explain.netPerPayday, paydayIncome.netCents, "=")),
        ],
        [
          targetCents !== null && format(messages.explain.paydayTarget, { amount: formatCents(targetCents, currency) }),
          messages.explain.rhythmNote,
          messages.explain.everydaySoFarNote,
        ],
      );
    },
  },
  /** Spending in the categories income groups deduct; a single category is named ("Car spending"). */
  deductions: {
    label: deductionsLabel,
    shown: hasDeductions,
    value: ({ income }) => ({ cents: -income.deductionsCents, tone: "muted" }),
    description: (_, messages) => messages.explain.aboutDeductions,
    explain: (context, messages, _, { label }) => explained([block(
      ...deductedCategories(context, context.income.deductCategoryIds).map(({ category, totalCents }) => amount(categoryLabel(category, messages.categories), totalCents, "+")),
      amount(label, context.income.deductionsCents, "="),
    )]),
  },
  /** Money on hand right now (cash, debit, and app balances outside savings), whatever the month; none until set in Settings. */
  cashOnHand: {
    label: (_, messages) => messages.month.cashOnHand,
    // Wallets in other currencies are noted, never added: currencies aren't converted.
    value: ({ cashOnHandCents, otherCash }) => (cashOnHandCents === null ? null : withNote(
      { cents: cashOnHandCents, tone: signTone(cashOnHandCents) },
      otherCash.length > 0 ? { text: otherCash.map((cash) => `+ ${formatCents(cash.cents, cash.currency, true)}`).join(" · "), tone: "muted" } : undefined,
    )),
    description: (_, messages) => messages.explain.aboutCashOnHand,
    explain: ({ cashOnHandCents, cashOnHandParts: parts, otherCash }, messages, _, { label, locale }) => {
      if (cashOnHandCents === null) return why(messages.explain.cashNotCounted);
      const otherWallets = otherCash.length > 0
        && format(messages.explain.otherCurrencies, { amounts: otherCash.map((cash) => `+ ${formatCents(cash.cents, cash.currency, true)}`).join(" · ") });
      if (!parts) return why(messages.explain.cashCards, otherWallets);
      return explained(
        [block(
          amount(format(messages.explain.countedOn, { date: formatShortDate(dateFromKey(parts.countedOn), locale) }), parts.countedCents),
          unlessZero(messages.explain.incomeSince, parts.incomeCents, "+"),
          unlessZero(messages.explain.cashPurchasesSince, parts.purchasesCents, "−"),
          unlessZero(messages.explain.billsPaidSince, parts.billsCents, "−"),
          bySign(parts.savingsCents, "−", messages.explain.movedToSavingsSince, messages.explain.takenFromSavingsSince),
          bySign(parts.transfersCents, "+", messages.explain.exchangedIn, messages.explain.exchangedOut),
          amount(label, parts.cents, "="),
        )],
        [messages.explain.cashCards, otherWallets],
      );
    },
  },
  /** Money in savings now, whatever the month, and how far it is from the savings goals. */
  savings: {
    label: (_, messages) => messages.savings.title,
    value: ({ savings, currency }, messages) => {
      if (!savings) return null;
      const balanceCents = sum(savings.funds.map((fund) => fund.balanceCents));
      const goalCents = sum(savings.funds.map((fund) => fund.goalCents));
      const goal = formatCents(goalCents, currency);
      const note: StatNote | undefined = goalCents <= 0 ? undefined
        : balanceCents >= goalCents ? { text: format(messages.month.goalReached, { goal }), tone: "gain" }
          : { text: format(messages.month.goalToGo, { goal, amount: formatCents(goalCents - balanceCents, currency) }), tone: "muted" };
      return withNote({ cents: balanceCents, tone: signTone(balanceCents) }, note);
    },
    description: (_, messages) => messages.explain.aboutSavings,
    explain: ({ savings }, messages, _, { label }) => {
      if (!savings || savings.funds.length === 0) return why(messages.explain.noSavings);
      const fundName = (fund: SavingsSnapshot["funds"][number]) => (fund.kind === "EMERGENCY" ? messages.savings.emergencyFund : (fund.name ?? ""));
      const balanceCents = sum(savings.funds.map((fund) => fund.balanceCents));
      const goalCents = sum(savings.funds.map((fund) => fund.goalCents));
      const { emergency } = savings;
      const goalLines = savings.funds.flatMap((fund) => fund.kind === "EMERGENCY" && emergency ? [
        amount(format(messages.explain.monthsOfSpending, { months: emergency.coverMonths }), emergency.emergencyCents, "+"),
        unlessZero(messages.savings.installmentsOwed, emergency.installmentsOwedCents, "+"),
      ] : [unlessZero(fundName(fund), fund.goalCents, "+")]);
      return explained(
        [
          block(...savings.funds.map((fund) => amount(fundName(fund), fund.balanceCents, "+")), amount(label, balanceCents, "=")),
          goalCents <= 0 ? [] : block(
            ...goalLines,
            amount(messages.savings.goal, goalCents, "="),
            amount(label, balanceCents, "−"),
            balanceCents >= goalCents ? amount(messages.explain.overGoal, balanceCents - goalCents, "=") : amount(messages.savings.pending, goalCents - balanceCents, "="),
          ),
        ].filter((lines) => lines.length > 0),
        [messages.explain.savingsKept],
      );
    },
  },
  /**
   * What's usually spent per day, week or month on everyday spending, a category, or an item, with what's been spent
   * so far in the one under way below it (yellow once past the usual). The parameter is "period:scope", like
   * "week:item.<id>".
   */
  averageSpending: {
    label: (context, messages, param) => {
      const parsed = parseSpendingParam(param);
      if (!parsed) return "";
      return format(messages.summary.averageLabel, { what: scopeName(context, messages, parsed.scope), period: periodName(parsed.period, messages) });
    },
    shown: (_, param) => parseSpendingParam(param) !== null,
    value: (context, messages, param) => {
      const found = spendingOn(context, param);
      if (!found) return null;
      const { averageCents, soFarCents } = found.figures;
      const soFar = formatCents(soFarCents, context.currency);
      return {
        cents: averageCents,
        note: { text: `${messages.summary.current[found.period]}: ${soFar}`, tone: soFarCents > averageCents ? "warning" : "muted" },
      };
    },
    description: (context, messages, param) => {
      const parsed = parseSpendingParam(param);
      if (!parsed) return messages.summary.aboutAverage;
      return format(messages.summary.aboutAverageOf, { what: scopeName(context, messages, parsed.scope), period: periodName(parsed.period, messages) });
    },
    explain: (context, messages, param, { label, locale }) => {
      const found = spendingOn(context, param);
      if (!found) return why();
      const { fromKey, days, totalCents, perDayCents, averageCents, soFarCents } = found.figures;
      const what = scopeName(context, messages, found.scope);
      const perDay = format(messages.summary.averageLabel, { what, period: periodName("day", messages) });
      const { blend } = found;
      return explained(
        [
          block(
            amount(format(messages.summary.spentSince, { what, date: formatShortDate(dateFromKey(fromKey), locale) }), totalCents),
            dayCount(messages.summary.overDays, days, "÷"),
            amount(blend ? messages.explain.recordsPerDay : perDay, blend ? blend.realCents : perDayCents, "="),
          ),
          blend ? blendBlock(blend, perDay, messages, context.currency) : [],
          found.period === "day" ? [] : block(
            amount(perDay, perDayCents),
            dayCount(messages.summary.daysPerPeriod[found.period], PERIOD_DAYS[found.period], "×"),
            amount(label, averageCents, "="),
          ),
          block(amount(messages.summary.current[found.period], soFarCents)),
        ].filter((lines) => lines.length > 0),
        [found.scope.kind === "all" ? messages.summary.everydayNote : null, messages.summary.fullAmountsNote],
      );
    },
  },
  /** This month's spending on a category or an item (everything is the plain `spending` stat); the parameter is "category.<id>" or "item.<id>". */
  spendingOn: {
    label: (context, messages, param) => {
      const scope = parseSpendingScope(param);
      return scope ? format(messages.summary.spendingOnLabel, { what: scopeName(context, messages, scope) }) : "";
    },
    shown: (_, param) => parseSpendingScope(param) !== null,
    value: (context, _, param) => {
      const scope = parseSpendingScope(param);
      return scope ? { cents: spendingOnCents(context, scope) } : null;
    },
    description: (context, messages, param) => {
      const scope = parseSpendingScope(param);
      return format(messages.summary.aboutSpendingOn, { what: scope ? scopeName(context, messages, scope) : "–" });
    },
    explain: (context, messages, param, { label }) => {
      const scope = parseSpendingScope(param);
      if (!scope) return why();
      const items = context.spending.byItem.filter(({ item }) => (scope.kind === "all" ? true : scope.kind === "category" ? item.category.id === scope.id : item.id === scope.id));
      return explained(
        [block(...items.map(({ item, totalCents }) => amount(item.name, totalCents, "+")), amount(label, spendingOnCents(context, scope), "="))],
        [messages.summary.spendingOnNote],
      );
    },
  },
  /**
   * Income today, this week, or this month, from all income, a group, or one source, gross or net of the deducted
   * categories. The parameter is "frame:scope:basis", like "week:group.<id>:net".
   */
  incomeOf: {
    label: (context, messages, param) => {
      const parsed = parseIncomeParam(param, INCOME_FRAMES);
      if (!parsed) return "";
      const what = incomeScopeName(context, messages, parsed.scope, parsed.basis);
      return parsed.step === "month" ? what : format(messages.summary.inFrame, { what, frame: messages.summary.frames[parsed.step] });
    },
    shown: (_, param) => parseIncomeParam(param, INCOME_FRAMES) !== null,
    value: (context, _, param) => {
      const found = incomeOfFigures(context, param);
      if (!found || "unavailable" in found) return null;
      return { cents: found.cents, tone: found.basis === "net" ? signTone(found.cents) : undefined };
    },
    description: (context, messages, param) => {
      const parsed = parseIncomeParam(param, INCOME_FRAMES);
      if (!parsed) return messages.summary.aboutIncomeOf;
      return format(messages.summary.aboutIncomeOfFrame[parsed.step], { what: incomeScopeName(context, messages, parsed.scope, parsed.basis) });
    },
    explain: (context, messages, param, { label, locale }) => {
      const found = incomeOfFigures(context, param);
      if (!found) return why();
      if ("unavailable" in found) return why(messages.summary.currentMonthOnly);
      const net = found.basis === "net";
      if (found.sources) {
        if (found.grossCents === 0 && !net) return why(messages.explain.noIncome);
        return explained([block(
          ...found.sources.map(({ source, totalCents }) => amount(source.name, totalCents, "+")),
          ...(net ? found.deducted.map(({ category, totalCents }) => amount(categoryLabel(category, messages.categories), totalCents, "−")) : []),
          amount(label, found.cents, "="),
        )]);
      }
      return explained(
        [block(
          amount(format(messages.summary.incomeSince, { date: formatShortDate(dateFromKey(found.fromKey), locale) }), found.grossCents),
          net ? amount(messages.summary.deductedPurchases, found.deductionsCents, "−") : null,
          amount(label, found.cents, "="),
        )],
        [net ? messages.summary.fullAmountsNote : null],
      );
    },
  },
  /**
   * What's usually earned per day worked, day, week or month from all income, a group, or one source, gross or net,
   * over the history window, with what's come in so far in the one under way below it (green once it's reached the
   * usual). The parameter is "per:scope:basis", like "workday:all:gross".
   */
  averageIncome: {
    label: (context, messages, param) => {
      const parsed = parseIncomeParam(param, INCOME_PERS);
      if (!parsed) return "";
      return format(messages.summary.averageLabel, { what: incomeScopeName(context, messages, parsed.scope, parsed.basis), period: perName(parsed.step, messages) });
    },
    shown: (_, param) => parseIncomeParam(param, INCOME_PERS) !== null,
    value: (context, messages, param) => {
      const found = averageIncomeFigures(context, param);
      if (!found) return null;
      const { averageCents, soFarCents } = found.figures;
      const current = messages.summary.current[found.per === "workday" ? "day" : found.per];
      return {
        cents: averageCents,
        tone: found.basis === "net" && averageCents < 0 ? "loss" : undefined,
        note: { text: `${current}: ${formatCents(soFarCents, context.currency)}`, tone: averageCents > 0 && soFarCents >= averageCents ? "gain" : "muted" },
      };
    },
    description: (context, messages, param) => {
      const parsed = parseIncomeParam(param, INCOME_PERS);
      if (!parsed) return messages.summary.aboutIncomeOf;
      return format(messages.summary.aboutAverageIncome, { what: incomeScopeName(context, messages, parsed.scope, parsed.basis), period: perName(parsed.step, messages) });
    },
    explain: (context, messages, param, { label, locale }) => {
      const found = averageIncomeFigures(context, param);
      if (!found) return why();
      const { fromKey, grossCents, deductionsCents, divisor, perDayCents, averageCents, soFarCents } = found.figures;
      if (divisor === 0) return why(messages.explain.noIncome);
      const { per } = found;
      const workday = per === "workday";
      const perDay = format(messages.summary.averageLabel, {
        what: incomeScopeName(context, messages, found.scope, found.basis), period: perName(workday ? "workday" : "day", messages),
      });
      return explained(
        [
          block(
            amount(format(messages.summary.incomeSince, { date: formatShortDate(dateFromKey(fromKey), locale) }), grossCents),
            found.basis === "net" ? amount(messages.summary.deductedPurchases, deductionsCents, "−") : null,
            dayCount(workday ? messages.explain.daysWithIncome : messages.summary.overDays, divisor, "÷"),
            amount(perDay, perDayCents, "="),
          ),
          per === "week" || per === "month" ? block(
            amount(perDay, perDayCents),
            dayCount(messages.summary.daysPerPeriod[per], PERIOD_DAYS[per], "×"),
            amount(label, averageCents, "="),
          ) : [],
          block(amount(messages.summary.current[per === "workday" ? "day" : per], soFarCents)),
        ].filter((lines) => lines.length > 0),
        [workday ? messages.explain.perDayWorked : null, messages.summary.historyNote, found.basis === "net" ? messages.summary.fullAmountsNote : null],
      );
    },
  },
} satisfies Record<string, StatDefinition>;

/** This month's spending (purchases, installments due, and recurring bills) on a category or an item. */
function spendingOnCents(context: StatContext, scope: SpendingScope) {
  if (scope.kind === "all") return context.spending.totalCents;
  if (scope.kind === "category") return context.spending.byCategory.find((entry) => entry.category.id === scope.id)?.totalCents ?? 0;
  return context.spending.byItem.find((entry) => entry.item.id === scope.id)?.totalCents ?? 0;
}

export type StatId = keyof typeof STATS;
type ParamStatId = "averageSpending" | "spendingOn" | "incomeOf" | "averageIncome";
/** A stat on a card: its id, or "id:param" for a stat built from settings, like "incomeOf:month:group.<id>:net". */
export type StatRef = Exclude<StatId, ParamStatId> | `${ParamStatId}:${string}`;

export type ResolvedStat = { ref: StatRef; label: string; value: StatValue };

/** A reference's stat definition and parameter, or null for an unknown stat. */
function statOf(ref: string) {
  const colon = ref.indexOf(":");
  const [id, param] = colon === -1 ? [ref, ""] : [ref.slice(0, colon), ref.slice(colon + 1)];
  return Object.hasOwn(STATS, id) ? { stat: STATS[id as StatId] as StatDefinition, param } : null;
}

/** The stats to show, in order, leaving out those hidden this month and any unknown reference. */
export function resolveStats(refs: StatRef[], context: StatContext, messages: Messages): ResolvedStat[] {
  return refs.flatMap((ref) => {
    const found = statOf(ref);
    if (!found) return [];
    const { stat, param } = found;
    if (stat.shown && !stat.shown(context, param)) return [];
    return [{ ref, label: stat.label(context, messages, param), value: stat.value(context, messages, param) }];
  });
}

/** A summary card: a headline figure above a two-column grid of stats. */
export type SummaryCardLayout = { headline: StatRef; grid: StatRef[] };

export const SUMMARY_CARD_IDS = ["month", "income"] as const;
export type SummaryCardId = (typeof SUMMARY_CARD_IDS)[number];
/** Customized cards as stored on the user; a card left out keeps its default. */
export type SummaryCards = Partial<Record<SummaryCardId, SummaryCardLayout>>;

/** Most stats a card's grid may hold. */
export const MAX_GRID_STATS = 12;

export function isSummaryCardId(value: string): value is SummaryCardId {
  return (SUMMARY_CARD_IDS as readonly string[]).includes(value);
}

const PARAM_STATS: readonly string[] = ["averageSpending", "spendingOn", "incomeOf", "averageIncome"] satisfies ParamStatId[];

/** Whether a string names a stat: a plain id, or a parameterized id with its parameter. */
export function isStatRef(value: string): value is StatRef {
  const colon = value.indexOf(":");
  const id = colon === -1 ? value : value.slice(0, colon);
  if (!Object.hasOwn(STATS, id)) return false;
  if (!PARAM_STATS.includes(id)) return colon === -1;
  if (colon === -1) return false;
  const param = value.slice(colon + 1);
  if (id === "averageSpending") return parseSpendingParam(param) !== null;
  if (id === "spendingOn") return parseSpendingScope(param)?.kind === "category" || parseSpendingScope(param)?.kind === "item";
  return parseIncomeParam(param, id === "incomeOf" ? INCOME_FRAMES : INCOME_PERS) !== null;
}

/**
 * Stats replaced by configurable ones, as the configurable stat with the same settings, so saved cards keep showing
 * the same figures.
 */
function migratedRef(value: string): string {
  if (value === "totalIncome") return "income";
  if (value === "netIncome") return "incomeOf:month:all:net";
  if (value === "incomeDayGross") return "averageIncome:workday:all:gross";
  if (value === "incomeDayNet") return "averageIncome:workday:all:net";
  if (value.startsWith("groupGross:")) return `incomeOf:month:group.${value.slice(11)}:gross`;
  if (value.startsWith("groupNet:")) return `incomeOf:month:group.${value.slice(9)}:net`;
  return value;
}

/** Stored customized cards, keeping only well-formed layouts and known stats. */
export function parseSummaryCards(stored: unknown): SummaryCards {
  if (!stored || typeof stored !== "object") return {};
  const cards: SummaryCards = {};
  for (const card of SUMMARY_CARD_IDS) {
    const layout = (stored as Record<string, unknown>)[card];
    if (!layout || typeof layout !== "object") continue;
    const { headline: storedHeadline, grid } = layout as { headline?: unknown; grid?: unknown };
    const headline = typeof storedHeadline === "string" ? migratedRef(storedHeadline) : null;
    if (headline === null || !isStatRef(headline) || !Array.isArray(grid)) continue;
    const refs = grid.flatMap((ref) => (typeof ref === "string" ? [migratedRef(ref)] : [])).filter(isStatRef);
    cards[card] = { headline, grid: [...new Set(refs)].slice(0, MAX_GRID_STATS) };
  }
  return cards;
}

/**
 * The month card by default: balance, then income and outstanding, spending and to pay, the daily pair (needed
 * per day and daily income) or the per-payday pair when income comes on paydays, and the projected balance with
 * the recurring income still expected.
 */
function monthCard(context: StatContext): SummaryCardLayout {
  const rates: StatRef[] = context.rhythm.kind === "DAILY" ? ["neededPerDay", "dailyIncome"] : ["neededPerPayday", "incomePerPayday"];
  return { headline: "balance", grid: ["income", "outstanding", "spending", "toPay", ...rates, "projectedBalance", "expectedIncome"] };
}

/**
 * The income card by default: deductions and net, the usual income per day worked (gross and net), and a gross and
 * net pair for each income group when the month also has income outside it (otherwise they'd repeat the totals).
 */
function incomeCard(context: StatContext): SummaryCardLayout {
  const deducts = hasDeductions(context);
  return {
    headline: "income",
    grid: [
      ...(deducts ? ["deductions", "incomeOf:month:all:net"] as const : []),
      "averageIncome:workday:all:gross",
      ...(deducts ? ["averageIncome:workday:all:net"] as const : []),
      ...context.income.byGroup.filter(({ group }) => groupShown(context, group.id))
        .flatMap(({ group }) => [`incomeOf:month:group.${group.id}:gross`, `incomeOf:month:group.${group.id}:net`] as const),
    ],
  };
}

export function defaultCardLayout(card: SummaryCardId, context: StatContext) {
  return card === "month" ? monthCard(context) : incomeCard(context);
}

/** A card's layout: the user's customized one, else the default. */
export function cardLayout(card: SummaryCardId, cards: SummaryCards, context: StatContext) {
  return cards[card] ?? defaultCardLayout(card, context);
}

/** Every fixed stat a card may offer, in library order; configurable stats are built from their settings instead. */
export function availableStats(context: StatContext): StatRef[] {
  return (Object.keys(STATS) as StatId[]).flatMap((id): StatRef[] => {
    if (PARAM_STATS.includes(id)) return [];
    if ((id === "neededPerPayday" || id === "incomePerPayday") && !notDaily(context)) return [];
    if (id === "daysOff" && notDaily(context)) return [];
    return [id as Exclude<StatId, ParamStatId>];
  });
}

/** Whether a stat shows this month; the card editor marks the ones that don't. */
export function statShown(ref: StatRef, context: StatContext) {
  const found = statOf(ref);
  return found !== null && (found.stat.shown?.(context, found.param) ?? true);
}

/** A stat's label, whether or not it shows this month, for listing it in the card editor. */
export function statLabel(ref: StatRef, context: StatContext, messages: Messages) {
  const found = statOf(ref);
  return found ? found.stat.label(context, messages, found.param) : ref;
}

/** What a stat is, in a sentence, whether or not it shows this month, for the card editor and its explanation. */
export function statDescription(ref: StatRef, context: StatContext, messages: Messages) {
  const found = statOf(ref);
  return found ? found.stat.description(context, messages, found.param) : "";
}

/** How this month's figures come to a stat's value, ending in its label; empty for an unknown stat. */
export function explainStat(ref: StatRef, context: StatContext, messages: Messages, locale: Locale): StatExplanation {
  const found = statOf(ref);
  if (!found) return { blocks: [], notes: [] };
  const { stat, param } = found;
  return stat.explain(context, messages, param, { label: stat.label(context, messages, param), locale });
}

/** The kinds of stat built from settings in the card editor. */
export const STAT_BUILDERS = ["averageSpending", "spending", "income", "averageIncome"] as const;
export type StatBuilder = (typeof STAT_BUILDERS)[number];
/** A configurable stat's settings as its editor form holds them. */
export type StatBuilderValues = { builder: StatBuilder; scope: string; period: string; source: string; basis: string; frame: string; per: string };

const BUILDER_DEFAULTS: Omit<StatBuilderValues, "builder"> = { scope: "all", period: "week", source: "all", basis: "gross", frame: "month", per: "workday" };

/** A stat's settings for its editor form, or null for a fixed stat. Plain spending and income are the builders' defaults. */
export function statBuilderValues(ref: StatRef): StatBuilderValues | null {
  const found = statOf(ref);
  if (!found) return null;
  const id = ref.slice(0, ref.indexOf(":") === -1 ? ref.length : ref.indexOf(":"));
  const { param } = found;
  if (id === "spending") return { builder: "spending", ...BUILDER_DEFAULTS };
  if (id === "income") return { builder: "income", ...BUILDER_DEFAULTS };
  if (id === "spendingOn") return { builder: "spending", ...BUILDER_DEFAULTS, scope: param };
  if (id === "averageSpending") {
    const parsed = parseSpendingParam(param);
    return parsed && { builder: "averageSpending", ...BUILDER_DEFAULTS, period: parsed.period, scope: param.slice(param.indexOf(":") + 1) };
  }
  if (id === "incomeOf" || id === "averageIncome") {
    const [step, source, basis] = param.split(":");
    return id === "incomeOf" ? { builder: "income", ...BUILDER_DEFAULTS, frame: step, source, basis } : { builder: "averageIncome", ...BUILDER_DEFAULTS, per: step, source, basis };
  }
  return null;
}

/**
 * The stat a builder's settings make, or null when they don't make one. Everything this month is the plain stat;
 * net for a single source, which has no deductions of its own, becomes gross.
 */
export function buildStatRef(values: Partial<StatBuilderValues>): StatRef | null {
  const { scope = "all", period = "", source = "all", frame = "", per = "" } = values;
  const basis = source.startsWith("source.") ? "gross" : values.basis;
  let ref: string;
  switch (values.builder) {
    case "averageSpending": ref = `averageSpending:${period}:${scope}`; break;
    case "spending": ref = scope === "all" ? "spending" : `spendingOn:${scope}`; break;
    case "income": ref = frame === "month" && source === "all" && basis === "gross" ? "income" : `incomeOf:${frame}:${source}:${basis}`; break;
    case "averageIncome": ref = `averageIncome:${per}:${source}:${basis}`; break;
    default: return null;
  }
  return isStatRef(ref) ? ref : null;
}

export { INCOME_FRAMES, INCOME_PERS, SPENDING_PERIODS, incomeScopeParam, parseIncomeScope };
export type { IncomeFrame };
