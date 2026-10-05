import type { LedgerIncome, MonthSpendingEntry } from "./ledger";
import { daysInMonth, dateKeyOf, type MonthKey } from "./months";

/**
 * A typical day's net over the days of a month that have passed (today included): income minus everyday spending
 * on those days, divided by the number of days. Everyday spending is purchases made this month in categories
 * counted in the average; recurring bills, installments of earlier purchases, and one-off extras are left out so
 * the month's big payments don't swamp the day-to-day picture. Null for a month that hasn't started.
 */
export function dailyNet({ month, today, entries, incomes }: {
  month: MonthKey;
  /** Today as "YYYY-MM-DD". */
  today: string;
  entries: MonthSpendingEntry[];
  incomes: LedgerIncome[];
}) {
  const currentMonth = today.slice(0, 7);
  if (month > currentMonth) return null;
  const lastDay = month === currentMonth ? today : `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const passed = (date: Date) => dateKeyOf(date) <= lastDay;
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const incomeCents = sum(incomes.filter((income) => passed(income.date)).map((income) => income.amountCents));
  const spendingCents = sum(
    entries
      .filter((entry) => entry.installmentNumber === 1 && entry.purchase.item.category.includeInAverage && passed(entry.purchase.date))
      .map((entry) => entry.amountCents),
  );
  const days = Number(lastDay.slice(8, 10));

  return { days, incomeCents, spendingCents, averageCents: Math.round((incomeCents - spendingCents) / days) };
}

/**
 * Income still needed per remaining day of the month (today included): `cents` to cover its total to pay, and
 * `forGoalCents` to also reach the balance goal, where money moved into savings counts toward the goal. Both are
 * zero once covered. Null for a month that has ended.
 */
export function neededPerDay({ month, today, toPayCents, incomeCents, savingsNetCents = 0, goalCents = null }: {
  month: MonthKey;
  today: string;
  toPayCents: number;
  incomeCents: number;
  savingsNetCents?: number;
  goalCents?: number | null;
}) {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return null;
  const daysLeft = month === currentMonth ? daysInMonth(month) - Number(today.slice(8, 10)) + 1 : daysInMonth(month);
  const perDay = (shortfallCents: number) => Math.max(0, Math.ceil(shortfallCents / daysLeft));
  return {
    daysLeft,
    cents: perDay(toPayCents - incomeCents),
    forGoalCents: goalCents === null ? null : perDay(goalCents - goalProgress({ balanceCents: incomeCents - toPayCents, savingsNetCents })),
  };
}

/** Progress toward the balance goal: the month's balance plus what it moved into savings, so saving never counts against it. */
export function goalProgress({ balanceCents, savingsNetCents }: { balanceCents: number; savingsNetCents: number }) {
  return balanceCents + savingsNetCents;
}
