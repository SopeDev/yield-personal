import type { Locale } from "../i18n/config";
import { format, type Messages } from "../i18n/dictionaries";
import { goalProgress } from "./daily-balance";
import { formatMonth } from "./dates";
import type { MonthSummary } from "./month-summary";
import type { MonthKey } from "./months";
import type { StatLine, StatNote, StatTone, StatValue } from "./stats";

type YearMonth = Pick<MonthSummary, "month" | "income" | "spending" | "cashFlow" | "savingsNetCents" | "balanceCents">;

/**
 * A calendar year at a glance, from the months that count: those that have started (through `currentMonth`) and
 * aren't before `historyStart`, since earlier months may hold only partial records. Totals add up those months;
 * the goal counts months whose balance plus savings reached it, out of the months that ended plus the current one
 * once it has reached it (a month still under way hasn't missed it yet). Each month's bar is its balance, or null
 * for a month that doesn't count.
 */
export function summarizeYear({ months, currentMonth, historyStart = null, goalCents = null }: {
  months: YearMonth[];
  currentMonth: MonthKey;
  historyStart?: MonthKey | null;
  goalCents?: number | null;
}) {
  const counts = (month: MonthKey) => month <= currentMonth && (!historyStart || month >= historyStart);
  const counted = months.filter((month) => counts(month.month));
  const sum = (value: (month: YearMonth) => number) => counted.reduce((total, month) => total + value(month), 0);
  const progressOf = (month: YearMonth) => goalProgress({ balanceCents: month.balanceCents, savingsNetCents: month.savingsNetCents });
  const reached = (month: YearMonth) => goalCents !== null && progressOf(month) >= goalCents;

  const balanceCents = sum((month) => month.balanceCents);
  const best = counted.reduce<YearMonth | null>((top, month) => (top === null || month.balanceCents > top.balanceCents ? month : top), null);
  const goalMonths = goalCents === null ? null : {
    reached: counted.filter(reached).length,
    of: counted.filter((month) => month.month < currentMonth || reached(month)).length,
  };

  return {
    monthsCounted: counted.length,
    incomeCents: sum((month) => month.income.totalCents),
    toPayCents: sum((month) => month.cashFlow.toPayCents),
    spendingCents: sum((month) => month.spending.totalCents),
    savedCents: sum((month) => month.savingsNetCents),
    balanceCents,
    averageBalanceCents: counted.length === 0 ? null : Math.round(balanceCents / counted.length),
    best: best && { month: best.month, balanceCents: best.balanceCents },
    goalMonths,
    bars: months.map((month) => ({
      month: month.month,
      /** Null for a month that hasn't started or comes before the history start. */
      balanceCents: counts(month.month) ? month.balanceCents : null,
      upcoming: month.month > currentMonth,
      goalReached: counts(month.month) && reached(month),
      /** How far the month's balance plus savings is from the goal (positive when short of it). */
      goalLeftCents: goalCents === null ? null : goalCents - progressOf(month),
    })),
  };
}

export type YearSummary = ReturnType<typeof summarizeYear>;
export type YearBar = YearSummary["bars"][number];

const signTone = (cents: number): StatTone => (cents < 0 ? "loss" : "gain");

/**
 * The year card's figures, each with what it is and how the year's months come to it: the year's balance (with how
 * often the goal was reached), then income and to pay, spending and saved, the average month and the best one.
 */
export function yearCardStats(year: YearSummary, { messages, locale }: { messages: Messages; locale: Locale }) {
  const m = messages.year;
  const monthsNote = year.monthsCounted === 1 ? m.overMonthsOne : format(m.overMonths, { count: year.monthsCounted });
  const counted = year.bars.filter((bar) => bar.balanceCents !== null);
  const notes = [m.countedNote];
  const stat = (key: string, label: string, value: StatValue, description: string, blocks: StatLine[][] = []) => ({
    key, label, value: year.monthsCounted === 0 ? null : value, description,
    explanation: { blocks: year.monthsCounted === 0 ? [] : blocks, notes: year.monthsCounted === 0 ? [m.noMonths] : notes },
  });
  const balanceLines: StatLine[] = [
    ...counted.map((bar, index): StatLine => ({ op: index === 0 ? undefined : "+", label: formatMonth(bar.month, locale), figure: { cents: bar.balanceCents ?? 0 } })),
    { op: "=", label: m.balance, figure: { cents: year.balanceCents } },
  ];

  const goalNote: StatNote | undefined = year.goalMonths && year.goalMonths.of > 0
    ? { text: format(m.goalReachedIn, { count: year.goalMonths.reached, total: year.goalMonths.of }), tone: year.goalMonths.reached > 0 ? "gain" : "muted" }
    : { text: monthsNote, tone: "muted" };

  return {
    headline: stat("balance", m.balance, { cents: year.balanceCents, tone: signTone(year.balanceCents), note: goalNote }, m.aboutBalance, [balanceLines]),
    grid: [
      stat("income", m.income, { cents: year.incomeCents }, m.aboutIncome),
      stat("toPay", m.toPay, { cents: year.toPayCents }, m.aboutToPay),
      stat("spending", m.spending, { cents: year.spendingCents }, m.aboutSpending),
      stat("saved", m.saved, { cents: year.savedCents }, m.aboutSaved),
      stat("averageBalance", m.averageBalance, year.averageBalanceCents === null ? null : { cents: year.averageBalanceCents, tone: signTone(year.averageBalanceCents) }, m.aboutAverageBalance, [[
        { label: m.balance, figure: { cents: year.balanceCents } },
        { op: "÷", label: m.monthsCounted, figure: { months: year.monthsCounted } },
        { op: "=", label: m.averageBalance, figure: { cents: year.averageBalanceCents ?? 0 } },
      ]]),
      stat("bestMonth", m.bestMonth, year.best && {
        cents: year.best.balanceCents, tone: signTone(year.best.balanceCents), note: { text: formatMonth(year.best.month, locale), tone: "muted" },
      }, m.aboutBestMonth),
    ],
  };
}
