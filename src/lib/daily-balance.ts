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
 * `excludeCategoryIds` leaves out categories that aren't spent every day, like the costs of working.
 */
export function typicalDailySpending({ purchases, today, historyStart = null, excludeCategoryIds = [] }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[];
  today: string;
  historyStart?: MonthKey | null;
  excludeCategoryIds?: string[];
}) {
  const { fromKey, days } = historyWindow(today, historyStart);
  if (days < 1) return { days: 0, cents: 0 };
  const spentCents = everydaySpending(purchases, { fromKey, today, include: (categoryId) => !excludeCategoryIds.includes(categoryId) });
  return { days, cents: Math.round(spentCents / days) };
}

/** The days figures from past spending look back over: the last full months through today, from `historyStart` on. */
function historyWindow(today: string, historyStart: MonthKey | null) {
  const lookback = addMonths(today.slice(0, 7) as MonthKey, -TYPICAL_SPENDING_MONTHS);
  const from = historyStart && historyStart > lookback ? historyStart : lookback;
  const fromKey = `${from}-01`;
  return { fromKey, days: Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1 };
}

/** Everyday purchases (without installments of earlier purchases) made from `fromKey` through `today` in the included categories. */
function everydaySpending(purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[], { fromKey, today, include }: {
  fromKey: string;
  today: string;
  include: (categoryId: string) => boolean;
}) {
  return purchases
    .filter((purchase) => isEveryday(purchase.item.category) && include(purchase.item.category.id))
    .filter((purchase) => dateKeyOf(purchase.date) >= fromKey && dateKeyOf(purchase.date) <= today)
    .reduce((sum, purchase) => sum + (consumptionInMonth(purchase, monthKeyOf(purchase.date))?.amountCents ?? 0), 0);
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

/**
 * Days off left this month at the recent pace of work, assuming the days off come after the work. The pace looks
 * back over the same days as typical daily spending (the last full months through today, from `historyStart` on):
 * a day worked is a day with income, and earns the average income per day worked minus the average everyday
 * spending in `workCategoryIds` (the costs of working, like gas, which a day off doesn't spend). Every day left,
 * worked or not, costs `livingDailyCents` (typical daily spending without those categories). The work days still
 * needed cover the month's total to pay (`days`) or also the balance goal (`forGoalDays`), rounded so the days off
 * never fall short; never below zero or above the days left (today included). Null outside the current month, before
 * any income, or when a day worked costs as much as it earns.
 */
export function daysOff({ month, today, historyStart = null, purchases, incomes, workCategoryIds, livingDailyCents, toPayCents, incomeCents, savingsNetCents = 0, goalCents = null }: {
  month: MonthKey;
  today: string;
  historyStart?: MonthKey | null;
  /** Purchases and incomes reaching back over the history window; earlier and later ones are ignored. */
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[];
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  workCategoryIds: string[];
  livingDailyCents: number;
  toPayCents: number;
  incomeCents: number;
  savingsNetCents?: number;
  goalCents?: number | null;
}) {
  if (month !== today.slice(0, 7)) return null;
  const { fromKey } = historyWindow(today, historyStart);
  const worked = incomes.filter((income) => dateKeyOf(income.date) >= fromKey && dateKeyOf(income.date) <= today);
  const workDays = new Set(worked.map((income) => dateKeyOf(income.date))).size;
  const grossCents = worked.reduce((sum, income) => sum + income.amountCents, 0);
  const workCostCents = everydaySpending(purchases, { fromKey, today, include: (categoryId) => workCategoryIds.includes(categoryId) });
  // Net earned over all the days worked; per day worked it is this ÷ workDays, kept whole to round exactly.
  const netCents = grossCents - workCostCents;
  if (workDays === 0 || netCents <= 0) return null;

  const daysLeft = daysInMonth(month) - Number(today.slice(8, 10)) + 1;
  // Days off = days left − (shortfall + living costs of the days left) ÷ net per day worked, rounded down.
  const off = (shortfallCents: number) => {
    const days = Math.floor((daysLeft * netCents - (shortfallCents + livingDailyCents * daysLeft) * workDays) / netCents);
    return Math.min(daysLeft, Math.max(0, days));
  };
  return {
    daysLeft,
    workDays,
    netPerWorkDayCents: Math.round(netCents / workDays),
    days: off(toPayCents - incomeCents),
    forGoalDays: goalCents === null ? null : off(goalCents - goalProgress({ balanceCents: incomeCents - toPayCents, savingsNetCents })),
  };
}

/** Progress toward the balance goal: the month's balance plus what it moved into savings, so saving never counts against it. */
export function goalProgress({ balanceCents, savingsNetCents }: { balanceCents: number; savingsNetCents: number }) {
  return balanceCents + savingsNetCents;
}
