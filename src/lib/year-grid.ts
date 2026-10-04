import type { LedgerCategory, LedgerItem } from "./ledger";
import type { MonthSummary } from "./month-summary";
import type { MonthKey } from "./months";

export type GridRow = { totalsCents: number[]; yearCents: number };
export type ItemRow = GridRow & { item: LedgerItem };
export type CategoryGroup = GridRow & { category: LedgerCategory; items: ItemRow[] };

function row(totalsCents: number[]): GridRow {
  return { totalsCents, yearCents: totalsCents.reduce((sum, value) => sum + value, 0) };
}

/**
 * The spreadsheet-style year grid: every category in display order with the items that had spending in any
 * month (largest yearly total first), then the monthly totals that close the sheet.
 */
export function buildYearGrid(months: MonthSummary[], categories: LedgerCategory[]) {
  const monthKeys: MonthKey[] = months.map((month) => month.month);

  const itemsById = new Map<string, LedgerItem>();
  const itemTotals = new Map<string, number[]>();
  months.forEach((month, index) => {
    for (const { item, totalCents } of month.spending.byItem) {
      itemsById.set(item.id, item);
      const totals = itemTotals.get(item.id) ?? new Array(months.length).fill(0);
      totals[index] += totalCents;
      itemTotals.set(item.id, totals);
    }
  });

  const groups: CategoryGroup[] = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => {
      const items = [...itemsById.values()]
        .filter((item) => item.category.id === category.id)
        .map((item) => ({ item, ...row(itemTotals.get(item.id)!) }))
        .sort((a, b) => b.yearCents - a.yearCents || a.item.name.localeCompare(b.item.name));
      const totals = months.map((month) => month.spending.byCategory.find((entry) => entry.category.id === category.id)?.totalCents ?? 0);
      return { category, items, ...row(totals) };
    });

  return {
    monthKeys,
    groups,
    spending: row(months.map((month) => month.spending.totalCents)),
    toPay: row(months.map((month) => month.cashFlow.toPayCents)),
    outstanding: row(months.map((month) => month.cashFlow.outstandingCents)),
    income: row(months.map((month) => month.income.totalCents)),
    balance: row(months.map((month) => month.balanceCents)),
  };
}
