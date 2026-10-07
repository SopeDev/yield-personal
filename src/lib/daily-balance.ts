import { isEveryday } from "./categories";
import { consumptionInMonth } from "./installments";
import type { LedgerIncome, LedgerPurchase, MonthSpendingEntry } from "./ledger";
import { addMonths, daysInMonth, dateKeyOf, monthKeyOf, type MonthKey } from "./months";

/**
 * A typical day's net over the days of a month that have passed (today included): income minus everyday spending
 * on those days, divided by the number of days. Everyday spending is purchases made this month in everyday
 * categories; recurring bills, installments of earlier purchases, bills and occasional categories are left out so
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
      .filter((entry) => entry.installmentNumber === 1 && isEveryday(entry.purchase.item.category) && passed(entry.purchase.date))
      .map((entry) => entry.amountCents),
  );
  const days = Number(lastDay.slice(8, 10));

  return { days, incomeCents, spendingCents, averageCents: Math.round((incomeCents - spendingCents) / days) };
}

/** Full months before the current one pooled into typical daily spending. */
export const TYPICAL_SPENDING_MONTHS = 3;

/**
 * What an ordinary day costs: everyday purchases (as in `dailyNet`: everyday categories, without
 * recurring bills or installments of earlier purchases) from the last full months through today, divided by
 * those days. Months before `historyStart` are skipped, since they may hold only partial records.
 */
export function typicalDailySpending({ purchases, today, historyStart = null }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[];
  today: string;
  historyStart?: MonthKey | null;
}) {
  const lookback = addMonths(today.slice(0, 7) as MonthKey, -TYPICAL_SPENDING_MONTHS);
  const from = historyStart && historyStart > lookback ? historyStart : lookback;
  const fromKey = `${from}-01`;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1;
  if (days < 1) return { days: 0, cents: 0 };

  const spentCents = purchases
    .filter((purchase) => isEveryday(purchase.item.category) && dateKeyOf(purchase.date) >= fromKey && dateKeyOf(purchase.date) <= today)
    .reduce((sum, purchase) => sum + (consumptionInMonth(purchase, monthKeyOf(purchase.date))?.amountCents ?? 0), 0);
  return { days, cents: Math.round(spentCents / days) };
}

/**
 * Income needed per remaining day of the month (today included): `cents` to cover its total to pay plus a
 * typical day's everyday spending still to come, and `forGoalCents` to also reach the balance goal, where money
 * moved into savings counts toward the goal. Both are zero once covered. Null for a month that has ended.
 */
export function neededPerDay({ month, today, toPayCents, incomeCents, savingsNetCents = 0, goalCents = null, typicalDailyCents = 0 }: {
  month: MonthKey;
  today: string;
  toPayCents: number;
  incomeCents: number;
  savingsNetCents?: number;
  goalCents?: number | null;
  typicalDailyCents?: number;
}) {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return null;
  const daysLeft = month === currentMonth ? daysInMonth(month) - Number(today.slice(8, 10)) + 1 : daysInMonth(month);
  const perDay = (shortfallCents: number) => Math.max(0, Math.ceil(shortfallCents / daysLeft + typicalDailyCents));
  return {
    daysLeft,
    typicalDailyCents,
    cents: perDay(toPayCents - incomeCents),
    forGoalCents: goalCents === null ? null : perDay(goalCents - goalProgress({ balanceCents: incomeCents - toPayCents, savingsNetCents })),
  };
}

/** Progress toward the balance goal: the month's balance plus what it moved into savings, so saving never counts against it. */
export function goalProgress({ balanceCents, savingsNetCents }: { balanceCents: number; savingsNetCents: number }) {
  return balanceCents + savingsNetCents;
}
