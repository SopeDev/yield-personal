import type { CategoryKind } from "./categories";
import { consumptionInMonth } from "./installments";
import type { MonthKey } from "./months";

export type LedgerCategory = { id: string; key: string | null; name: string | null; sortOrder: number; kind: CategoryKind };
export type LedgerPaymentMethod = { id: string; kind: "CASH" | "CARD"; name: string; color: string };
/** A reusable expense concept; its category groups it. */
export type LedgerItem = { id: string; name: string; category: LedgerCategory };
export type LedgerPurchase = {
  id: string;
  date: Date;
  amountCents: number;
  note: string | null;
  installmentCount: number;
  item: LedgerItem;
  paymentMethod: LedgerPaymentMethod;
};
export type LedgerIncomeSource = { id: string; name: string; groupId: string | null };
/** Income sources grouped for a net figure: the group's income after spending in `deductCategoryIds`. */
export type LedgerIncomeGroup = { id: string; name: string; deductCategoryIds: string[] };
export type LedgerIncome = { id: string; date: Date; amountCents: number; note: string | null; source: LedgerIncomeSource };

export type MonthSpendingEntry = {
  purchase: LedgerPurchase;
  /** The amount counted this month: the full amount, or one installment. */
  amountCents: number;
  installmentNumber: number;
};

/** Spending that counts toward a month's consumption, newest first. */
export function monthSpendingEntries(purchases: LedgerPurchase[], month: MonthKey): MonthSpendingEntry[] {
  return purchases
    .flatMap((purchase) => {
      const portion = consumptionInMonth(purchase, month);
      return portion ? [{ purchase, ...portion }] : [];
    })
    .sort((a, b) => b.purchase.date.getTime() - a.purchase.date.getTime());
}

/** One amount of spending in a month, attributed to an expense item. */
export type SpendingAmount = { item: LedgerItem; amountCents: number };

/**
 * Totals for a month from purchase portions and recurring payments: per category (every category listed, in
 * display order) and per item (items with spending, grouped by category order, largest first).
 */
export function summarizeSpending(amounts: SpendingAmount[], categories: LedgerCategory[]) {
  const categoryTotals = new Map(categories.map((category) => [category.id, 0]));
  const itemTotals = new Map<string, { item: LedgerItem; totalCents: number }>();
  for (const { item, amountCents } of amounts) {
    categoryTotals.set(item.category.id, (categoryTotals.get(item.category.id) ?? 0) + amountCents);
    const current = itemTotals.get(item.id) ?? { item, totalCents: 0 };
    current.totalCents += amountCents;
    itemTotals.set(item.id, current);
  }

  const byCategory = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({ category, totalCents: categoryTotals.get(category.id) ?? 0 }));
  const byItem = [...itemTotals.values()].sort(
    (a, b) => a.item.category.sortOrder - b.item.category.sortOrder || b.totalCents - a.totalCents || a.item.name.localeCompare(b.item.name),
  );
  const totalCents = byCategory.reduce((sum, item) => sum + item.totalCents, 0);

  return { byCategory, byItem, totalCents };
}

export function spendingAmountsOf(entries: MonthSpendingEntry[]): SpendingAmount[] {
  return entries.map((entry) => ({ item: entry.purchase.item, amountCents: entry.amountCents }));
}

/**
 * A month's income by source and by income group, with each group's net after the spending it deducts, and the
 * daily average over the days with income recorded (days worked). Overall net is all income after every
 * deducted category's spending, each category counted once even when several groups deduct it.
 */
export function summarizeIncome(incomes: LedgerIncome[], { groups = [], spendingByCategory = [] }: {
  groups?: LedgerIncomeGroup[];
  spendingByCategory?: { category: LedgerCategory; totalCents: number }[];
} = {}) {
  const bySourceId = new Map<string, { source: LedgerIncomeSource; totalCents: number }>();
  for (const income of incomes) {
    const current = bySourceId.get(income.source.id) ?? { source: income.source, totalCents: 0 };
    current.totalCents += income.amountCents;
    bySourceId.set(income.source.id, current);
  }

  const bySource = [...bySourceId.values()].sort((a, b) => b.totalCents - a.totalCents);
  const totalCents = bySource.reduce((sum, item) => sum + item.totalCents, 0);
  const spentIn = (categoryIds: Iterable<string>) =>
    [...new Set(categoryIds)].reduce((sum, id) => sum + (spendingByCategory.find((entry) => entry.category.id === id)?.totalCents ?? 0), 0);

  const byGroup = groups
    .map((group) => {
      const grossCents = bySource.filter((item) => item.source.groupId === group.id).reduce((sum, item) => sum + item.totalCents, 0);
      const deductionsCents = spentIn(group.deductCategoryIds);
      return { group, grossCents, deductionsCents, netCents: grossCents - deductionsCents };
    })
    .filter((entry) => entry.grossCents > 0)
    .sort((a, b) => b.grossCents - a.grossCents);

  const deductCategoryIds = [...new Set(groups.flatMap((group) => group.deductCategoryIds))];
  const deductionsCents = spentIn(deductCategoryIds);
  const netCents = totalCents - deductionsCents;
  const daysWithIncome = new Set(incomes.map((income) => income.date.getTime())).size;
  const perDay = (cents: number) => (daysWithIncome > 0 ? Math.round(cents / daysWithIncome) : 0);

  return {
    bySource,
    byGroup,
    totalCents,
    /** The categories deducted by any income group, and their spending this month. */
    deductCategoryIds,
    deductionsCents,
    /** All income after the deducted categories' spending. */
    netCents,
    daysWithIncome,
    dailyGrossCents: perDay(totalCents),
    dailyNetCents: perDay(netCents),
  };
}
