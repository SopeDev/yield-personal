import type { Locale } from "../i18n/config";
import { format, type Messages } from "../i18n/dictionaries";
import type { CashOnHandParts } from "./cash-on-hand";
import { categoryLabel } from "./categories";
import { dailyNet, daysLeftIn, daysOff, goalProgress, incomePace, neededPerDay, projectedBalance, typicalDailySpending } from "./daily-balance";
import { formatShortDate } from "./dates";
import { incomePerPayday, neededPerPayday, type IncomeRhythm } from "./income-rhythm";
import type { LedgerIncome, LedgerPurchase } from "./ledger";
import { DEFAULT_CURRENCY, formatCents, type Currency } from "./money";
import type { MonthSummary } from "./month-summary";
import { dateFromKey, type MonthKey } from "./months";
import { expectedIncomeLeft, expectedPaydays, type RecurringIncomeDefinition } from "./recurring-income";

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
export type StatOp = "+" | "−" | "÷" | "=";
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
export type StatSettings = { balanceGoalCents: number | null; historyStartMonth: MonthKey | null; incomeRhythm?: IncomeRhythm; currency?: Currency };

/** A month's figures from which every stat is calculated, plus money on hand, which is the same in every month. */
export function monthStatContext({ view, today, settings, cashOnHandCents = null, cashOnHandParts = null, otherCash = [], incomeGroups = [] }: {
  view: Pick<MonthSummary, "month" | "entries" | "occurrences" | "incomes" | "income" | "spending" | "cashFlow" | "savingsNetCents" | "balanceCents"> & {
    /** Recent purchases and incomes (back to the history window), for figures from past spending and work. */
    purchases: LedgerPurchase[];
    recentIncomes?: LedgerIncome[];
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
  /** Income groups to name in group stats even in a month without their income, as the card editor lists them. */
  incomeGroups?: { id: string; name: string }[];
}) {
  const { month, entries, incomes, income, cashFlow, savingsNetCents, balanceCents } = view;
  const goalCents = settings.balanceGoalCents;
  const rhythm = settings.incomeRhythm ?? { kind: "DAILY" };
  const dayNet = dailyNet({ month, today, entries, incomes });
  const typicalDay = typicalDailySpending({ purchases: view.purchases, today, historyStart: settings.historyStartMonth });
  // Recurring income still expected this month counts as coming; it is no part of the pace of other income.
  const recurringIncomes = view.recurringIncomes ?? [];
  const paydays = expectedPaydays(recurringIncomes, incomes, month);
  const expected = expectedIncomeLeft(paydays);
  const recurringSourceIds = new Set(recurringIncomes.map((recurring) => recurring.source.id));
  const paceIncomes = (view.recentIncomes ?? incomes).filter((item) => !item.recurringIncomeId && !recurringSourceIds.has(item.source.id));
  const pace = incomePace({ incomes: paceIncomes, today, historyStart: settings.historyStartMonth });
  const needed = neededPerDay({
    month, today, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents + expected.cents, savingsNetCents, goalCents, typicalDailyCents: typicalDay.cents,
  });
  const goalProgressCents = goalProgress({ balanceCents, savingsNetCents });
  // The categories income groups deduct are the costs of working, spent only on days worked.
  const workCategoryIds = income.deductCategoryIds;
  const livingDay = typicalDailySpending({ purchases: view.purchases, today, historyStart: settings.historyStartMonth, excludeCategoryIds: workCategoryIds });
  return {
    ...view,
    today,
    currency: settings.currency ?? DEFAULT_CURRENCY,
    others: view.others ?? [],
    cashOnHandCents,
    cashOnHandParts,
    otherCash,
    incomeGroups,
    goalCents,
    rhythm,
    dayNet,
    typicalDay,
    livingDay,
    pace,
    needed,
    neededPayday: neededPerPayday({
      month, today, rhythm, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents, goalProgressCents, goalCents, typicalDailyCents: typicalDay.cents,
    }),
    daysOff: daysOff({
      month, today, historyStart: settings.historyStartMonth, purchases: view.purchases, incomes: paceIncomes,
      workCategoryIds, livingDailyCents: livingDay.cents,
      toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents + expected.cents, savingsNetCents, goalCents,
    }),
    paydays,
    expected,
    projected: projectedBalance({
      month, today, balanceCents, expectedCents: expected.cents, typicalDailyCents: typicalDay.cents, paceDailyCents: pace.cents,
    }),
    paydayIncome: dayNet ? incomePerPayday({ month, today, rhythm, incomeCents: dayNet.incomeCents, everydaySpendingCents: dayNet.spendingCents }) : null,
    // The day's target is the goal's when one is set; average daily income is gross, like the target.
    targetCents: needed ? (needed.forGoalCents ?? needed.cents) : null,
    dailyIncomeCents: dayNet ? Math.round(dayNet.incomeCents / dayNet.days) : null,
    // Money moved into savings counts toward the goal.
    goalLeftCents: goalCents === null ? 0 : goalCents - goalProgressCents,
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
  groupOf(context, groupId)?.group.name ?? context.incomeGroups.find((group) => group.id === groupId)?.name ?? "";
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

const everydayNote = ({ typicalDay }: StatContext, messages: Messages) => format(messages.explain.everydayNote, { days: typicalDay.days });

/**
 * What income still has to cover this month: its total to pay less its income (and, `withExpected`, recurring income
 * still expected), or with a goal, what still reaches the goal, where money moved into savings counts toward it.
 */
function shortfall(context: StatContext, messages: Messages, { withExpected }: { withExpected: boolean }) {
  const { goalCents, cashFlow, income, expected, savingsNetCents } = context;
  const expectedCents = withExpected ? expected.cents : 0;
  const breakEvenCents = cashFlow.toPayCents - income.totalCents - expectedCents;
  const cents = goalCents === null ? breakEvenCents : goalCents + breakEvenCents - savingsNetCents;
  return {
    cents,
    lines: [
      goalCents === null ? null : amount(messages.explain.goal, goalCents),
      amount(messages.month.toPay, cashFlow.toPayCents, "+"),
      amount(messages.month.income, income.totalCents, "−"),
      unlessZero(messages.month.expectedIncome, expectedCents, "−"),
      goalCents === null ? null : bySign(savingsNetCents, "−", messages.explain.movedToSavings, messages.explain.takenFromSavings),
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
    explain: ({ income, cashFlow, balanceCents, goalCents, goalLeftCents, savingsNetCents }, messages, _, { label }) => {
      const balance = block(amount(messages.month.income, income.totalCents), amount(messages.month.toPay, cashFlow.toPayCents, "−"), amount(label, balanceCents, "="));
      if (goalCents === null) return explained([balance], [messages.explain.noGoal]);
      const goal = block(
        amount(messages.explain.goal, goalCents),
        amount(label, balanceCents, "−"),
        bySign(savingsNetCents, "−", messages.explain.movedToSavings, messages.explain.takenFromSavings),
        goalLeftCents > 0 ? amount(messages.explain.stillToGo, goalLeftCents, "=") : amount(messages.explain.overGoal, -goalLeftCents, "="),
      );
      return explained([balance, goal], [messages.explain.goalSavings]);
    },
  },
  income: {
    label: (_, messages) => messages.month.income,
    value: ({ income, others }) => withNote({ cents: income.totalCents }, othersNote(others, "incomeCents")),
    description: (_, messages) => messages.explain.aboutIncome,
    explain: (context, messages, _, { label }) => incomeExplanation(context, messages, label),
  },
  /** Total income, with the number of days that had any. */
  totalIncome: {
    label: (_, messages) => messages.income.total,
    value: ({ income, others }, messages) => {
      const days = income.daysWithIncome === 0 ? null
        : income.daysWithIncome === 1 ? messages.income.daysWithIncomeOne : format(messages.income.daysWithIncome, { count: income.daysWithIncome });
      const otherIncome = othersNote(others, "incomeCents")?.text ?? null;
      const text = [otherIncome, days].filter(Boolean).join(" · ");
      return withNote({ cents: income.totalCents, tone: "gain" }, text ? { text, tone: "muted" } : undefined);
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
    explain: ({ cashFlow, savingsNetCents, others }, messages, _, { label }) => explained(
      [block(
        amount(messages.explain.cashPurchases, cashFlow.cashPurchasesCents),
        unlessZero(messages.explain.cashBills, cashFlow.cashBillsCents, "+"),
        unlessZero(messages.explain.statementsClosing, cashFlow.statementsClosingCents, "+"),
        bySign(savingsNetCents, "+", messages.explain.movedToSavings, messages.explain.takenFromSavings),
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
  /** Gross income per day passed, against the day's target, with daily net below. */
  dailyIncome: {
    label: (_, messages) => messages.month.dailyIncome,
    value: ({ dayNet, dailyIncomeCents, targetCents, currency }, messages) => {
      if (!dayNet || dailyIncomeCents === null) return null;
      return {
        cents: dailyIncomeCents,
        tone: targetCents === null ? undefined : dailyIncomeCents >= targetCents ? "gain" : "warning",
        note: { text: format(messages.month.netPerDay, { amount: formatCents(dayNet.averageCents, currency) }), tone: "muted" },
      };
    },
    description: (_, messages) => messages.explain.aboutDailyIncome,
    explain: ({ dayNet, dailyIncomeCents, targetCents, currency }, messages, _, { label }) => {
      if (!dayNet || dailyIncomeCents === null) return why(messages.explain.monthAhead);
      const incomeSoFar = amount(messages.explain.incomeSoFar, dayNet.incomeCents);
      const daysSoFar = dayCount(messages.explain.daysSoFar, dayNet.days, "÷");
      return explained(
        [
          block(incomeSoFar, daysSoFar, amount(label, dailyIncomeCents, "=")),
          block(incomeSoFar, amount(messages.explain.everydaySoFar, dayNet.spendingCents, "−"), daysSoFar, amount(messages.explain.netPerDay, dayNet.averageCents, "=")),
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
      return { days: daysOff.days, tone: tone(daysOff.days), note: { text: format(messages.month.daysOffOf, { count: daysOff.daysLeft }), tone: "muted" } };
    },
    description: ({ goalCents }, messages) => (goalCents === null ? messages.explain.aboutDaysOff : messages.explain.aboutDaysOffGoal),
    explain: (context, messages, _, { label }) => {
      const { daysOff, livingDay, typicalDay, month, today, currency } = context;
      if (!daysOff) return why(month === today.slice(0, 7) ? format(messages.explain.daysOffNoPace, { days: typicalDay.days }) : messages.explain.currentMonthOnly);
      const { daysLeft } = daysOff;
      const workDaysNeeded = daysOff.forGoalWorkDaysNeeded ?? daysOff.workDaysNeeded;
      const toCover = shortfall(context, messages, { withExpected: true });
      const livingCents = livingDay.cents * daysLeft;
      const living = format(messages.explain.livingForDaysLeft, { amount: formatCents(livingDay.cents, currency), days: daysText(daysLeft, messages) });
      return explained(
        [
          block(
            ...toCover.lines,
            amount(living, livingCents, "+"),
            amount(messages.explain.neededFromWork, toCover.cents + livingCents, "="),
            amount(messages.explain.netPerWorkDay, daysOff.netPerWorkDayCents, "÷"),
            dayCount(messages.explain.workDaysNeeded, workDaysNeeded, "="),
          ),
          block(dayCount(messages.explain.daysLeft, daysLeft), dayCount(messages.explain.workDaysNeeded, workDaysNeeded, "−"), dayCount(label, daysOff.forGoalDays ?? daysOff.days, "=")),
        ],
        [
          workDaysNeeded > daysLeft && messages.explain.moreWorkThanDays,
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
    value: ({ projected, expected, goalCents, savingsNetCents, currency }, messages) => {
      if (!projected) return null;
      let note: StatNote | undefined;
      if (goalCents !== null) {
        // Money moved into savings counts toward the goal, as in the balance's progress.
        const overCents = goalProgress({ balanceCents: projected.cents, savingsNetCents }) - goalCents;
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
      const days = daysText(projected.daysLeft, messages);
      return explained(
        [block(
          amount(messages.month.balance, balanceCents),
          unlessZero(messages.month.expectedIncome, expected.cents, "+"),
          amount(format(messages.explain.paceForDaysLeft, { amount: formatCents(pace.cents, currency), days }), pace.cents * projected.daysLeft, "+"),
          amount(format(messages.explain.everydayForDaysLeft, { amount: formatCents(typicalDay.cents, currency), days }), typicalDay.cents * projected.daysLeft, "−"),
          amount(label, projected.cents, "="),
        )],
        [format(messages.explain.paceNote, { days: pace.days }), everydayNote(context, messages), goalCents !== null && messages.explain.goalSavings],
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
  netIncome: {
    label: (_, messages) => messages.income.net,
    shown: hasDeductions,
    value: ({ income }) => ({ cents: income.netCents, tone: signTone(income.netCents) }),
    description: (_, messages) => messages.explain.aboutNetIncome,
    explain: (context, messages, _, { label }) => explained([block(
      amount(messages.month.income, context.income.totalCents),
      amount(deductionsLabel(context, messages), context.income.deductionsCents, "−"),
      amount(label, context.income.netCents, "="),
    )]),
  },
  /** Gross income per day with income recorded. */
  incomeDayGross: {
    label: (_, messages) => messages.income.dailyGross,
    value: ({ income }) => ({ cents: income.dailyGrossCents }),
    description: (_, messages) => messages.explain.aboutIncomeDayGross,
    explain: ({ income }, messages, _, { label }) => {
      if (income.daysWithIncome === 0) return why(messages.explain.noIncome);
      return explained(
        [block(amount(messages.month.income, income.totalCents), dayCount(messages.explain.daysWithIncome, income.daysWithIncome, "÷"), amount(label, income.dailyGrossCents, "="))],
        [messages.explain.perDayWorked],
      );
    },
  },
  /** Net income per day with income recorded. */
  incomeDayNet: {
    label: (_, messages) => messages.income.dailyNet,
    value: ({ income }) => ({ cents: income.dailyNetCents, tone: signTone(income.dailyNetCents) }),
    description: (_, messages) => messages.explain.aboutIncomeDayNet,
    explain: (context, messages, _, { label }) => {
      const { income } = context;
      if (income.daysWithIncome === 0) return why(messages.explain.noIncome);
      const deducts = income.deductionsCents !== 0;
      return explained(
        [block(
          amount(messages.month.income, income.totalCents),
          deducts ? amount(deductionsLabel(context, messages), income.deductionsCents, "−") : null,
          deducts ? amount(messages.income.net, income.netCents, "=") : null,
          dayCount(messages.explain.daysWithIncome, income.daysWithIncome, "÷"),
          amount(label, income.dailyNetCents, "="),
        )],
        [messages.explain.perDayWorked],
      );
    },
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
  /** An income group's gross; the parameter is the group's id. */
  groupGross: {
    label: (context, messages, groupId) => format(messages.income.groupGross, { group: groupName(context, groupId) }),
    shown: groupShown,
    value: (context, _, groupId) => ({ cents: groupOf(context, groupId)?.grossCents ?? 0 }),
    description: (context, messages, groupId) => format(messages.explain.aboutGroupGross, { group: groupName(context, groupId) }),
    explain: (context, messages, groupId, { label }) => {
      const group = groupOf(context, groupId);
      if (!group) return why(messages.explain.noIncome);
      return explained([block(
        ...context.income.bySource.filter(({ source }) => source.groupId === groupId).map(({ source, totalCents }) => amount(source.name, totalCents, "+")),
        amount(label, group.grossCents, "="),
      )]);
    },
  },
  /** An income group's net after the categories it deducts; the parameter is the group's id. */
  groupNet: {
    label: (context, messages, groupId) => format(messages.income.groupNet, { group: groupName(context, groupId) }),
    shown: groupShown,
    value: (context, _, groupId) => {
      const netCents = groupOf(context, groupId)?.netCents ?? 0;
      return { cents: netCents, tone: signTone(netCents) };
    },
    description: (context, messages, groupId) => format(messages.explain.aboutGroupNet, { group: groupName(context, groupId) }),
    explain: (context, messages, groupId, { label }) => {
      const group = groupOf(context, groupId);
      if (!group) return why(messages.explain.noIncome);
      return explained([block(
        amount(format(messages.income.groupGross, { group: group.group.name }), group.grossCents),
        ...deductedCategories(context, group.group.deductCategoryIds).map(({ category, totalCents }) => amount(categoryLabel(category, messages.categories), totalCents, "−")),
        amount(label, group.netCents, "="),
      )]);
    },
  },
} satisfies Record<string, StatDefinition>;

export type StatId = keyof typeof STATS;
type ParamStatId = "groupGross" | "groupNet";
/** A stat on a card: its id, or "id:param" for a stat about one thing, like "groupNet:<group id>". */
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

const PARAM_STATS: readonly string[] = ["groupGross", "groupNet"] satisfies ParamStatId[];

/** Whether a string names a stat: a plain id, or a parameterized id with its parameter. */
export function isStatRef(value: string): value is StatRef {
  const colon = value.indexOf(":");
  const id = colon === -1 ? value : value.slice(0, colon);
  if (!Object.hasOwn(STATS, id)) return false;
  return PARAM_STATS.includes(id) ? colon > 0 && value.length > colon + 1 : colon === -1;
}

/** Stored customized cards, keeping only well-formed layouts and known stats. */
export function parseSummaryCards(stored: unknown): SummaryCards {
  if (!stored || typeof stored !== "object") return {};
  const cards: SummaryCards = {};
  for (const card of SUMMARY_CARD_IDS) {
    const layout = (stored as Record<string, unknown>)[card];
    if (!layout || typeof layout !== "object") continue;
    const { headline, grid } = layout as { headline?: unknown; grid?: unknown };
    if (typeof headline !== "string" || !isStatRef(headline) || !Array.isArray(grid)) continue;
    cards[card] = { headline, grid: grid.filter((ref): ref is StatRef => typeof ref === "string" && isStatRef(ref)).slice(0, MAX_GRID_STATS) };
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

/** The income card by default, followed by a gross and net pair for each income group that had income. */
function incomeCard(context: StatContext): SummaryCardLayout {
  return {
    headline: "totalIncome",
    grid: [
      "deductions", "netIncome", "incomeDayGross", "incomeDayNet",
      ...context.income.byGroup.flatMap(({ group }) => [`groupGross:${group.id}`, `groupNet:${group.id}`] as const),
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

/** Every stat a card may show, in library order, with a gross and net pair for each of the given income groups. */
export function availableStats(context: StatContext, groups: { id: string }[]): StatRef[] {
  return (Object.keys(STATS) as StatId[]).flatMap((id): StatRef[] => {
    if (id === "groupGross" || id === "groupNet") return groups.map((group) => `${id}:${group.id}` as const);
    if ((id === "neededPerPayday" || id === "incomePerPayday") && !notDaily(context)) return [];
    if (id === "daysOff" && notDaily(context)) return [];
    return [id];
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
