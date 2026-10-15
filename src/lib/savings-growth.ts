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
  /** Money already moved into the fund today, so today's planned deposit is taken as done. */
  depositedToday: boolean;
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
  const deposits = funds.map((fund) => new Set(fund.deposit ? depositDays(fund.deposit.rhythm, today, end).filter((day) => day !== today || !fund.depositedToday) : []));
  const events: ForecastEvent[] = [];
  const result: { date: string; savingsCents: number; interestCents: number; depositedCents: number }[] = [];
  let interest = 0;
  let deposited = 0;
  for (let index = 0; index <= days; index += 1) {
    const date = addDays(today, index);
    funds.forEach((fund, which) => {
      if (fund.deposit && deposits[which].has(date)) {
        balances[which] += fund.deposit.cents;
        deposited += fund.deposit.cents;
        events.push({ date, kind: "savings", label: fund.name, cents: -fund.deposit.cents, estimated: false, overdue: false });
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
