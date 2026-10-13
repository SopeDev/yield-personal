import { isEveryday } from "./categories";
import { consumptionInMonth } from "./installments";
import type { LedgerIncome, LedgerPurchase, MonthSpendingEntry } from "./ledger";
import { addMonths, daysInMonth, dateKeyOf, monthKeyOf, type MonthKey } from "./months";

/**
 * A typical day's net over the days of a month that have passed (today included, unless `finishedOnly`): income minus everyday spending
 * on those days, divided by the number of days. Everyday spending is purchases made this month in everyday
 * categories; recurring bills, installments of earlier purchases, bills and occasional categories are left out so
 * the month's big payments don't swamp the day-to-day picture. Null for a month that hasn't started.
 */
export function dailyNet({ month, today, entries, incomes, finishedOnly = false }: {
  month: MonthKey;
  /** Today as "YYYY-MM-DD". */
  today: string;
  entries: MonthSpendingEntry[];
  incomes: LedgerIncome[];
  /**
   * Count the current month only through yesterday, so a day under way (income logged at night) never pulls the
   * average down; on the 1st, with no finished day yet, today counts.
   */
  finishedOnly?: boolean;
}) {
  const currentMonth = today.slice(0, 7);
  if (month > currentMonth) return null;
  const dayOfMonth = Number(today.slice(8, 10));
  const throughYesterday = finishedOnly && month === currentMonth && dayOfMonth > 1;
  const lastDay = month !== currentMonth ? `${month}-${String(daysInMonth(month)).padStart(2, "0")}`
    : throughYesterday ? `${month}-${String(dayOfMonth - 1).padStart(2, "0")}` : today;
  const passed = (date: Date) => dateKeyOf(date) <= lastDay;
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const incomeCents = sum(incomes.filter((income) => passed(income.date)).map((income) => income.amountCents));
  const spendingCents = sum(
    entries
      .filter((entry) => entry.installmentNumber === 1 && isEveryday(entry.purchase.item.category) && passed(entry.purchase.date))
      .map((entry) => entry.amountCents),
  );
  const days = Number(lastDay.slice(8, 10));

  return { days, throughYesterday, incomeCents, spendingCents, averageCents: Math.round((incomeCents - spendingCents) / days) };
}

/** Full months before the current one pooled into typical daily spending. */
export const TYPICAL_SPENDING_MONTHS = 3;

/**
 * What an ordinary day costs: everyday purchases (as in `dailyNet`: everyday categories, without
 * recurring bills or installments of earlier purchases) from the last full months through yesterday (finished days only), divided by
 * those days. Months before `historyStart` are skipped, since they may hold only partial records.
 * `excludeCategoryIds` leaves out categories that aren't spent every day, like the costs of working.
 */
export function typicalDailySpending({ purchases, today, historyStart = null, excludeCategoryIds = [] }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[];
  today: string;
  historyStart?: MonthKey | null;
  excludeCategoryIds?: string[];
}) {
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  if (days < 1) return { days: 0, cents: 0 };
  const spentCents = everydaySpending(purchases, { fromKey, toKey, include: (categoryId) => !excludeCategoryIds.includes(categoryId) });
  return { days, cents: Math.round(spentCents / days) };
}

/**
 * The days figures from past spending and work look back over: the last full months through yesterday, from
 * `historyStart` on. Only finished days count, so a day under way (gas bought in the morning, income logged at night)
 * never skews the averages; on the first day of the history there is no finished day yet, so it counts today.
 */
function historyWindow(today: string, historyStart: MonthKey | null) {
  const lookback = addMonths(today.slice(0, 7) as MonthKey, -TYPICAL_SPENDING_MONTHS);
  const from = historyStart && historyStart > lookback ? historyStart : lookback;
  const fromKey = `${from}-01`;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const toKey = yesterday >= fromKey ? yesterday : today;
  return { fromKey, toKey, days: Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1 };
}

/** Everyday purchases (without installments of earlier purchases) made from `fromKey` through `toKey` in the included categories. */
function everydaySpending(purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[], { fromKey, toKey, include }: {
  fromKey: string;
  toKey: string;
  include: (categoryId: string) => boolean;
}) {
  return purchases
    .filter((purchase) => isEveryday(purchase.item.category) && include(purchase.item.category.id))
    .filter((purchase) => dateKeyOf(purchase.date) >= fromKey && dateKeyOf(purchase.date) <= toKey)
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
  const daysLeft = daysLeftIn(month, today);
  if (daysLeft === null) return null;
  const perDay = (shortfallCents: number) => Math.max(0, Math.ceil(shortfallCents / daysLeft + typicalDailyCents));
  return {
    daysLeft,
    typicalDailyCents,
    cents: perDay(toPayCents - incomeCents),
    forGoalCents: goalCents === null ? null : perDay(goalCents - goalProgress({ balanceCents: incomeCents - toPayCents, savingsNetCents })),
  };
}

/** Days left in a month, today included: all of a month still to come, none (null) for one that has ended. */
export function daysLeftIn(month: MonthKey, today: string) {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return null;
  return month === currentMonth ? daysInMonth(month) - Number(today.slice(8, 10)) + 1 : daysInMonth(month);
}

/**
 * Income per day at the recent pace: income over the same days as typical daily spending (the last full months
 * through yesterday, from `historyStart` on), divided by all those days, so days off count. Recurring income is left
 * out by the caller, since its paydays are expected instead.
 */
export function incomePace({ incomes, today, historyStart = null }: {
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  today: string;
  historyStart?: MonthKey | null;
}) {
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  if (days < 1) return { days: 0, cents: 0 };
  const cents = incomes
    .filter((income) => dateKeyOf(income.date) >= fromKey && dateKeyOf(income.date) <= toKey)
    .reduce((sum, income) => sum + income.amountCents, 0);
  return { days, cents: Math.round(cents / days) };
}

/**
 * Today so far: income and everyday purchases (in the included categories, as typical daily spending counts them)
 * already recorded today. Forecasts count only the rest of an average day on top, so a day reads the same whether
 * its records come in the morning, midday, or at night.
 */
export function todaySoFar({ purchases, incomes, today, include = () => true }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item">[];
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  today: string;
  include?: (categoryId: string) => boolean;
}) {
  const todays = incomes.filter((income) => dateKeyOf(income.date) === today);
  return {
    hasIncome: todays.length > 0,
    incomeCents: todays.reduce((sum, income) => sum + income.amountCents, 0),
    spentCents: everydaySpending(purchases, { fromKey: today, toKey: today, include }),
  };
}

/**
 * Where the month's balance is headed: its balance so far, plus recurring income still expected, plus the rest of
 * today (what an average day still has to bring in and spend beyond today's records, never below zero), plus each
 * day after today at the recent pace of other income minus typical daily spending. A month still to come has no
 * today: every one of its days counts at the pace. Null for a month that has ended.
 */
export function projectedBalance({ month, today, balanceCents, expectedCents, paceDailyCents, typicalDailyCents, todayIncomeCents = 0, todaySpentCents = 0 }: {
  month: MonthKey;
  today: string;
  balanceCents: number;
  expectedCents: number;
  paceDailyCents: number;
  typicalDailyCents: number;
  /** Income and everyday spending already recorded today (the pace's kind of income and typical spending's purchases). */
  todayIncomeCents?: number;
  todaySpentCents?: number;
}) {
  const daysLeft = daysLeftIn(month, today);
  if (daysLeft === null) return null;
  const isCurrent = month === today.slice(0, 7);
  const daysAfterToday = isCurrent ? daysLeft - 1 : daysLeft;
  const todayIncomeLeftCents = isCurrent ? Math.max(0, paceDailyCents - todayIncomeCents) : 0;
  const todaySpendingLeftCents = isCurrent ? Math.max(0, typicalDailyCents - todaySpentCents) : 0;
  return {
    daysLeft,
    daysAfterToday,
    todayIncomeLeftCents,
    todaySpendingLeftCents,
    cents: balanceCents + expectedCents + todayIncomeLeftCents - todaySpendingLeftCents + (paceDailyCents - typicalDailyCents) * daysAfterToday,
  };
}

/**
 * Days off left this month at the recent pace of work, assuming the days off come after the work. The pace looks
 * back over the same days as typical daily spending (the last full months through yesterday, from `historyStart` on):
 * a day worked is a day with income, and earns the average income per day worked minus the average everyday
 * spending in `workCategoryIds` (the costs of working, like gas, which a day off doesn't spend). Every day left,
 * worked or not, costs `livingDailyCents` (typical daily spending without those categories). The work days still
 * needed cover the month's total to pay (`days`) or also the balance goal (`forGoalDays`), in tenths of a day rounded
 * so the days off never fall short; never below zero or above the days still free (the days left, without today once it has income: a day worked is no day off). Null outside the current month, before
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
  const { fromKey, toKey } = historyWindow(today, historyStart);
  const worked = incomes.filter((income) => dateKeyOf(income.date) >= fromKey && dateKeyOf(income.date) <= toKey);
  const workDays = new Set(worked.map((income) => dateKeyOf(income.date))).size;
  const grossCents = worked.reduce((sum, income) => sum + income.amountCents, 0);
  const workCostCents = everydaySpending(purchases, { fromKey, toKey, include: (categoryId) => workCategoryIds.includes(categoryId) });
  // Net earned over all the days worked; per day worked it is this ÷ workDays, kept whole to round exactly.
  const netCents = grossCents - workCostCents;
  if (workDays === 0 || netCents <= 0) return null;

  const daysLeft = daysInMonth(month) - Number(today.slice(8, 10)) + 1;
  // A day with income is a day worked, so it can't also be a day off: the days free to work or rest start tomorrow.
  // Today's living costs count only what's left of an average day beyond what today has already spent.
  const soFar = todaySoFar({ purchases, incomes, today, include: (categoryId) => !workCategoryIds.includes(categoryId) });
  const freeDays = soFar.hasIncome ? daysLeft - 1 : daysLeft;
  const livingTodayLeftCents = Math.max(0, livingDailyCents - soFar.spentCents);
  const livingCents = livingDailyCents * (daysLeft - 1) + livingTodayLeftCents;
  // Work days needed = (shortfall + living costs of the days left) ÷ net per day worked, rounded up to a tenth of a
  // day; the rest are days off, so they round down to a tenth and never promise more than there is. Kept in whole
  // tenths until the end so the subtraction is exact.
  const workTenthsFor = (shortfallCents: number) => Math.max(0, Math.ceil(((shortfallCents + livingCents) * workDays * 10) / netCents));
  const workDaysFor = (shortfallCents: number) => workTenthsFor(shortfallCents) / 10;
  const off = (workDaysNeeded: number) => Math.max(0, freeDays * 10 - Math.round(workDaysNeeded * 10)) / 10;
  const workDaysNeeded = workDaysFor(toPayCents - incomeCents);
  const forGoalWorkDaysNeeded = goalCents === null ? null : workDaysFor(goalCents - goalProgress({ balanceCents: incomeCents - toPayCents, savingsNetCents }));
  return {
    daysLeft,
    /** Days still free to work or rest: the days left, without today once it has income. */
    freeDays,
    workedToday: soFar.hasIncome,
    /** Living costs still to come: every day after today, and what's left of today's. */
    livingCents,
    livingTodayLeftCents,
    workDays,
    netPerWorkDayCents: Math.round(netCents / workDays),
    workDaysNeeded,
    forGoalWorkDaysNeeded,
    days: off(workDaysNeeded),
    forGoalDays: forGoalWorkDaysNeeded === null ? null : off(forGoalWorkDaysNeeded),
  };
}

/** Progress toward the balance goal: the month's balance plus what it moved into savings, so saving never counts against it. */
export function goalProgress({ balanceCents, savingsNetCents }: { balanceCents: number; savingsNetCents: number }) {
  return balanceCents + savingsNetCents;
}
