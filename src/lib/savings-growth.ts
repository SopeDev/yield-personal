import { addDays, type ForecastEvent } from "./forecast";
import { paydaysInMonth } from "./income-rhythm";
import { addMonths, type MonthKey } from "./months";
import type { RecurringIncomeRhythm } from "./recurring-income";

/** A savings fund as the forecast grows it: its balance now, the interest it earns, and any planned deposit. */
export type GrowingFund = {
  id: string;
  name: string;
  balanceCents: number;
  /** Annual rate in basis points (1500 = 15%), or null for none. */
  rateBps: number | null;
  /** The last day of a promotional rate ("YYYY-MM-DD"); after it the fund earns `afterBps`. */
  rateUntil: string | null;
  afterBps: number | null;
  deposit: { cents: number; rhythm: RecurringIncomeRhythm } | null;
  /** Planned deposit days already done (see `matchDeposits`), which the forecast no longer moves. */
  doneDates: string[];
  /** What's already gone in for planned days only partly made, by day: the forecast moves only the rest. */
  partlyMade?: Record<string, number>;
};

/** Days interest is spread over in a year, as banks count it day by day. */
const DAYS_PER_YEAR = 365;

/** The annual rate a fund earns on a day, in basis points: its promotional rate through its last day, then the next. */
export function rateOn(fund: Pick<GrowingFund, "rateBps" | "rateUntil" | "afterBps">, dateKey: string) {
  if (fund.rateUntil && dateKey > fund.rateUntil) return fund.afterBps ?? 0;
  return fund.rateBps ?? 0;
}

/** Interest a fund earns a day on its balance now, at today's rate. */
export function dailyInterestCents(fund: Pick<GrowingFund, "balanceCents" | "rateBps" | "rateUntil" | "afterBps">, today: string) {
  return (fund.balanceCents * rateOn(fund, today)) / 10000 / DAYS_PER_YEAR;
}

/** A planned deposit's days from `fromKey` through `toKey`. */
export function depositDays(rhythm: RecurringIncomeRhythm, fromKey: string, toKey: string) {
  const days: string[] = [];
  for (let month = fromKey.slice(0, 7) as MonthKey; month <= toKey.slice(0, 7); month = addMonths(month, 1)) {
    days.push(...paydaysInMonth(rhythm, month).filter((day) => day >= fromKey && day <= toKey));
  }
  return days;
}

/**
 * Savings day by day from today, for each day of the forecast: every fund's balance with its planned deposits on
 * their days and its interest added daily on the balance (compounding, at the rate of that day), all together. Also
 * the deposits, as events taking money out of cash on their days.
 */
export function projectSavings({ today, days, funds }: { today: string; days: number; funds: GrowingFund[] }) {
  const end = addDays(today, days);
  const balances = funds.map((fund) => fund.balanceCents);
  const deposits = funds.map((fund) => new Set(fund.deposit ? depositDays(fund.deposit.rhythm, today, end).filter((day) => !fund.doneDates.includes(day)) : []));
  const events: ForecastEvent[] = [];
  const result: { date: string; savingsCents: number; interestCents: number; depositedCents: number }[] = [];
  let interest = 0;
  let deposited = 0;
  for (let index = 0; index <= days; index += 1) {
    const date = addDays(today, index);
    funds.forEach((fund, which) => {
      const due = fund.deposit && deposits[which].has(date) ? fund.deposit.cents - (fund.partlyMade?.[date] ?? 0) : 0;
      if (due > 0) {
        balances[which] += due;
        deposited += due;
        events.push({ date, kind: "savings", label: fund.name, cents: -due, estimated: false, overdue: false });
      }
      const earned = (balances[which] * rateOn(fund, date)) / 10000 / DAYS_PER_YEAR;
      balances[which] += earned;
      interest += earned;
    });
    result.push({ date, savingsCents: Math.round(balances.reduce((sum, balance) => sum + balance, 0)), interestCents: Math.round(interest), depositedCents: deposited });
  }
  return { days: result, events };
}

/** An annual rate typed as a percentage ("15", "8.5" or "8,5") in basis points, or null when it isn't one (0–100%). */
export function parseRatePercent(text: string) {
  const value = Number(text.trim().replace("%", "").replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(value) || value <= 0 || value > 100) return null;
  return Math.round(value * 100);
}

/** Basis points as a percentage to show or edit: 1500 → "15", 850 → "8.5". */
export const ratePercent = (bps: number) => String(bps / 100);

/** How far before and after a planned deposit's day a deposit into its fund counts as making it. */
export const DEPOSIT_MATCH_DAYS = { before: 3, after: 10 } as const;

/** What went into a fund for one planned day: the deposits' total, their days (the last one in `date`), and whether they cover the plan. */
export type DepositMade = { date: string; dates: string[]; amountCents: number; complete: boolean };

/**
 * Which planned deposits were made: each planned day, in order, takes the deposits into the fund (money in, not yet
 * taken by an earlier day) from 3 days before it to 10 days after, so a deposit made a little early or late still
 * counts, and one split in several still adds up. With `plannedCents` a day takes deposits until they come to it
 * (it's complete then, and partly made until); without it, one deposit makes a day. What went in for each day, or null.
 */
export function matchDeposits<M extends { date: string; amountCents: number }>(plannedDays: string[], movements: M[], plannedCents?: number) {
  const deposits = movements.filter((movement) => movement.amountCents > 0).sort((a, b) => a.date.localeCompare(b.date));
  const used = new Set<M>();
  return new Map(plannedDays.map((day): [string, DepositMade | null] => {
    const from = addDays(day, -DEPOSIT_MATCH_DAYS.before);
    const to = addDays(day, DEPOSIT_MATCH_DAYS.after);
    const taken: M[] = [];
    let cents = 0;
    for (const deposit of deposits) {
      if (used.has(deposit) || deposit.date < from || deposit.date > to) continue;
      used.add(deposit);
      taken.push(deposit);
      cents += deposit.amountCents;
      if (plannedCents === undefined || cents >= plannedCents) break;
    }
    if (taken.length === 0) return [day, null];
    const dates = taken.map((deposit) => deposit.date);
    return [day, { date: dates.at(-1)!, dates, amountCents: cents, complete: plannedCents === undefined || cents >= plannedCents }];
  }));
}
