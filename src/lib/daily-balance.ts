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

/** How far back things bought rarely are averaged, and the least they're spread over (see `windowSpending`). */
export const RARE_LOOKBACK_DAYS = 365;
/** Months of purchases loaded for it: a year back. */
export const RARE_LOOKBACK_MONTHS = 12;
export const RARE_MIN_DAYS = 90;
/** An item bought less often than once in this many days, or only once, is bought rarely. */
const RARE_GAP_DAYS = 30;
/** A rare item is spread out only when big for its category: this many times the category's middle purchase or more. */
const RARE_SIZE_FACTOR = 2;

/**
 * What an ordinary day costs: everyday purchases (as in `dailyNet`: everyday categories, without
 * recurring bills or installments of earlier purchases) from the last full months through yesterday (finished days only), divided by
 * those days, with things bought rarely spread over their own longer span (`windowSpending`). Months before
 * `historyStart` are skipped, since they may hold only partial records.
 * `excludeCategoryIds` leaves out categories that aren't spent every day, like the costs of working.
 */
export function typicalDailySpending({ purchases, today, historyStart = null, excludeCategoryIds = [], estimates = [] }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[];
  today: string;
  /** The first month, or day, counted. */
  historyStart?: string | null;
  excludeCategoryIds?: string[];
  /** Monthly estimates per category, blended in while there's little history (`blendWithEstimate`). */
  estimates?: CategoryEstimate[];
}) {
  const { days } = historyWindow(today, historyStart);
  const estimateMonthlyCents = estimates.filter((estimate) => !excludeCategoryIds.includes(estimate.categoryId)).reduce((sum, estimate) => sum + estimate.monthlyCents, 0);
  if (days < 1) return { days: 0, rare: { names: [], spreadDays: 0 }, ...blendWithEstimate(0, 0, estimateMonthlyCents) };
  const spent = windowSpending(purchases, { today, historyStart, include: (categoryId) => !excludeCategoryIds.includes(categoryId) });
  return { days, rare: { names: spent.rareNames, spreadDays: spent.rareDays }, ...blendWithEstimate(spent.cents / days, days, estimateMonthlyCents) };
}

/**
 * Everyday spending over the history window (`historyWindow`), with big things bought rarely counted at their own
 * pace. An item bought often (gas, coffee) counts as bought in the window. An item bought rarely (only once, or less
 * than monthly) that's big for its category (twice its middle purchase or more, like brakes beside gas) is averaged
 * over the last year instead, from `historyStart` on, and spread over at least 3 months even with less history: one
 * set of brakes in a few weeks isn't a set every few weeks. That pace, over the window's days, is what it adds. Small
 * things bought once (a new restaurant) stay as bought: together they're everyday spending. Items are told apart by
 * name, whatever their category.
 */
export function windowSpending(purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[], { today, historyStart = null, include }: {
  today: string;
  historyStart?: string | null;
  include: (categoryId: string) => boolean;
}) {
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  const start = historyStart && historyStart.length === 7 ? `${historyStart}-01` : historyStart;
  const yearBack = new Date(Date.parse(`${toKey}T00:00:00Z`) - (RARE_LOOKBACK_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const longFrom = start && start > yearBack ? start : yearBack;
  const longDays = Math.max(1, Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${longFrom}T00:00:00Z`)) / 86_400_000) + 1);
  const amountOf = (purchase: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount">) => consumptionInMonth(purchase, monthKeyOf(purchase.date))?.amountCents ?? 0;

  const byItem = new Map<string, { name: string; categoryId: string; count: number; longCents: number; windowCents: number }>();
  const amountsByCategory = new Map<string, number[]>();
  for (const purchase of purchases) {
    const day = dateKeyOf(purchase.date);
    if (purchase.planned || !isEveryday(purchase.item.category) || !include(purchase.item.category.id) || day < longFrom || day > toKey) continue;
    amountsByCategory.set(purchase.item.category.id, [...(amountsByCategory.get(purchase.item.category.id) ?? []), amountOf(purchase)]);
    const entry = byItem.get(purchase.item.id) ?? { name: purchase.item.name, categoryId: purchase.item.category.id, count: 0, longCents: 0, windowCents: 0 };
    entry.count += 1;
    entry.longCents += amountOf(purchase);
    if (day >= fromKey) entry.windowCents += amountOf(purchase);
    byItem.set(purchase.item.id, entry);
  }
  const rareDays = Math.min(RARE_LOOKBACK_DAYS, Math.max(RARE_MIN_DAYS, longDays));
  let cents = 0;
  const rareNames: string[] = [];
  for (const entry of byItem.values()) {
    const rare = (entry.count === 1 || longDays / entry.count > RARE_GAP_DAYS)
      && entry.longCents / entry.count >= RARE_SIZE_FACTOR * median(amountsByCategory.get(entry.categoryId) ?? []);
    if (!rare) {
      cents += entry.windowCents;
    } else {
      cents += (entry.longCents / rareDays) * days;
      // Named only when the window itself holds it, as the things that make its typical day.
      if (entry.windowCents > 0) rareNames.push(entry.name);
    }
  }
  return { cents: Math.round(cents), fromKey, toKey, days, rareDays, rareNames };
}

/** The middle value (the mean of the two middle ones for an even count); 0 for none. */
function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** A category's estimated monthly spending, from the setup wizard. */
export type CategoryEstimate = { categoryId: string; monthlyCents: number };

/** Days of history after which estimates no longer count. */
export const ESTIMATE_DAYS = 30;
/** Days in an average month. */
export const DAYS_PER_MONTH = 30.4;

/**
 * A per-day figure from `days` of records, with a monthly estimate standing in for what's missing: all estimate with
 * no history, fading out evenly until real records alone count after `ESTIMATE_DAYS`. `estimateShare` is how much of
 * the figure is still the estimate (0 when there's none), and `realCents` the figure from records alone.
 */
export function blendWithEstimate(realPerDay: number, days: number, estimateMonthlyCents: number) {
  const realCents = Math.round(realPerDay);
  if (estimateMonthlyCents <= 0 || days >= ESTIMATE_DAYS) return { cents: realCents, realCents, estimateShare: 0, estimateMonthlyCents: 0 };
  const estimateShare = 1 - Math.max(0, days) / ESTIMATE_DAYS;
  const cents = Math.round(realPerDay * (1 - estimateShare) + (estimateMonthlyCents / DAYS_PER_MONTH) * estimateShare);
  return { cents, realCents, estimateShare, estimateMonthlyCents };
}

/**
 * The days figures from past spending and work look back over: the last full months through yesterday, from
 * `historyStart` on (a month, or for a new account the day it started keeping records). Only finished days count, so
 * a day under way (gas bought in the morning, income logged at night) never skews the averages; on the first day of
 * the history there is no finished day yet, so it counts today.
 */
export function historyWindow(today: string, historyStart: string | null) {
  const lookback = `${addMonths(today.slice(0, 7) as MonthKey, -TYPICAL_SPENDING_MONTHS)}-01`;
  const start = historyStart && historyStart.length === 7 ? `${historyStart}-01` : historyStart;
  const fromKey = start && start > lookback ? start : lookback;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const toKey = yesterday >= fromKey ? yesterday : today;
  return { fromKey, toKey, days: Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1 };
}

/** Everyday purchases (without installments of earlier purchases) made from `fromKey` through `toKey` in the included categories. */
function everydaySpending(purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[], { fromKey, toKey, include, withPlanned = false }: {
  fromKey: string;
  toKey: string;
  include: (categoryId: string) => boolean;
  /** Counts purchases still planned too (today's, which the day is expected to spend); averages never do. */
  withPlanned?: boolean;
}) {
  return purchases
    .filter((purchase) => isEveryday(purchase.item.category) && include(purchase.item.category.id) && (withPlanned || !purchase.planned))
    .filter((purchase) => dateKeyOf(purchase.date) >= fromKey && dateKeyOf(purchase.date) <= toKey)
    .reduce((sum, purchase) => sum + (consumptionInMonth(purchase, monthKeyOf(purchase.date))?.amountCents ?? 0), 0);
}

/**
 * Income needed per remaining day of the month (today included): `cents` to cover its total to pay plus a
 * typical day's everyday spending still to come, and `forGoalCents` to also reach the balance goal. Both are zero once covered. Null for a month that has ended.
 */
export function neededPerDay({ month, today, toPayCents, incomeCents, goalCents = null, typicalDailyCents = 0 }: {
  month: MonthKey;
  today: string;
  toPayCents: number;
  incomeCents: number;
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
    forGoalCents: goalCents === null ? null : perDay(goalCents + toPayCents - incomeCents),
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
export function incomePace({ incomes, today, historyStart = null, estimateMonthlyCents = 0 }: {
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  today: string;
  historyStart?: string | null;
  /** Estimated monthly income, blended in while there's little history (`blendWithEstimate`). */
  estimateMonthlyCents?: number;
}) {
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  if (days < 1) return { days: 0, ...blendWithEstimate(0, 0, estimateMonthlyCents) };
  const cents = incomes
    .filter((income) => dateKeyOf(income.date) >= fromKey && dateKeyOf(income.date) <= toKey)
    .reduce((sum, income) => sum + income.amountCents, 0);
  return { days, ...blendWithEstimate(cents / days, days, estimateMonthlyCents) };
}

/**
 * Today so far: income and everyday purchases (in the included categories, as typical daily spending counts them)
 * already recorded today. Forecasts count only the rest of an average day on top, so a day reads the same whether
 * its records come in the morning, midday, or at night.
 */
export function todaySoFar({ purchases, incomes, today, include = () => true }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[];
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  today: string;
  include?: (categoryId: string) => boolean;
}) {
  const todays = incomes.filter((income) => dateKeyOf(income.date) === today);
  return {
    hasIncome: todays.length > 0,
    incomeCents: todays.reduce((sum, income) => sum + income.amountCents, 0),
    // Something planned for today is part of what today spends, confirmed or not.
    spentCents: everydaySpending(purchases, { fromKey: today, toKey: today, include, withPlanned: true }),
  };
}

/**
 * How much of the everyday purchases planned for the days after today, through `toKey`, an average day already
 * covers: each day's planned everyday spending up to `typicalDailyCents`. A plan counts in full where it's recorded
 * (the month's total to pay, the forecast's events), so the average day it falls on spends only what's left of it,
 * as today does with what it has already spent.
 */
export function plannedEverydayOverlap({ purchases, today, toKey, typicalDailyCents }: {
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[];
  today: string;
  toKey: string;
  typicalDailyCents: number;
}) {
  const byDay = new Map<string, number>();
  for (const purchase of purchases) {
    const day = dateKeyOf(purchase.date);
    if (!purchase.planned || day <= today || day > toKey || !isEveryday(purchase.item.category)) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + (consumptionInMonth(purchase, monthKeyOf(purchase.date))?.amountCents ?? 0));
  }
  return [...byDay.values()].reduce((sum, cents) => sum + Math.min(cents, typicalDailyCents), 0);
}

/**
 * How much of the pace the expected one-off income on the days after today replaces: on each day, each source's
 * expected income up to that source's share of the pace (`sourcePaceCents`). The pace counts that source's income
 * spread over every day; on a day its payment is expected, the payment is that day's income from it.
 */
export function expectedIncomeOverlap({ expected, today, sourcePaceCents }: {
  expected: Pick<LedgerIncome, "date" | "amountCents" | "source">[];
  today: string;
  sourcePaceCents: (sourceId: string) => number;
}) {
  const byDaySource = new Map<string, { sourceId: string; cents: number }>();
  for (const income of expected) {
    const day = dateKeyOf(income.date);
    if (day <= today) continue;
    const key = `${day}|${income.source.id}`;
    byDaySource.set(key, { sourceId: income.source.id, cents: (byDaySource.get(key)?.cents ?? 0) + income.amountCents });
  }
  const paceOf = new Map<string, number>();
  return [...byDaySource.values()].reduce((total, { sourceId, cents }) => {
    if (!paceOf.has(sourceId)) paceOf.set(sourceId, sourcePaceCents(sourceId));
    return total + Math.min(cents, paceOf.get(sourceId)!);
  }, 0);
}

/**
 * Where the month's balance is headed: its balance so far, plus recurring income still expected, plus the rest of
 * today (what an average day still has to bring in and spend beyond today's records, never below zero), plus each
 * day after today at the recent pace of other income minus typical daily spending. A month still to come has no
 * today: every one of its days counts at the pace. Null for a month that has ended.
 */
export function projectedBalance({ month, today, balanceCents, expectedCents, paceDailyCents, typicalDailyCents, todayIncomeCents = 0, todaySpentCents = 0, plannedOverlapCents = 0, expectedOverlapCents = 0 }: {
  month: MonthKey;
  today: string;
  balanceCents: number;
  expectedCents: number;
  paceDailyCents: number;
  typicalDailyCents: number;
  /** Income and everyday spending already recorded today (the pace's kind of income and typical spending's purchases). */
  todayIncomeCents?: number;
  todaySpentCents?: number;
  /** Planned everyday purchases on the days after today that an average day already covers (`plannedEverydayOverlap`). */
  plannedOverlapCents?: number;
  /** The pace that expected one-off income replaces on its days (`expectedIncomeOverlap`), counted once in `expectedCents`. */
  expectedOverlapCents?: number;
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
    plannedOverlapCents,
    expectedOverlapCents,
    cents: balanceCents + expectedCents + todayIncomeLeftCents - todaySpendingLeftCents + (paceDailyCents - typicalDailyCents) * daysAfterToday
      + plannedOverlapCents - expectedOverlapCents,
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
export function daysOff({ month, today, historyStart = null, purchases, incomes, workCategoryIds, livingDailyCents, toPayCents, incomeCents, goalCents = null }: {
  month: MonthKey;
  today: string;
  historyStart?: string | null;
  /** Purchases and incomes reaching back over the history window; earlier and later ones are ignored. */
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "installmentCount" | "item" | "planned">[];
  incomes: Pick<LedgerIncome, "date" | "amountCents">[];
  workCategoryIds: string[];
  livingDailyCents: number;
  toPayCents: number;
  incomeCents: number;
  goalCents?: number | null;
}) {
  if (month !== today.slice(0, 7)) return null;
  const { fromKey, toKey } = historyWindow(today, historyStart);
  const worked = incomes.filter((income) => dateKeyOf(income.date) >= fromKey && dateKeyOf(income.date) <= toKey);
  const workDays = new Set(worked.map((income) => dateKeyOf(income.date))).size;
  const grossCents = worked.reduce((sum, income) => sum + income.amountCents, 0);
  // Things bought rarely for work (like brakes) count at their own pace, as in typical spending.
  const workCostCents = windowSpending(purchases, { today, historyStart, include: (categoryId) => workCategoryIds.includes(categoryId) }).cents;
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
  const forGoalWorkDaysNeeded = goalCents === null ? null : workDaysFor(goalCents + toPayCents - incomeCents);
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

