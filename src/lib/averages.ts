import { countsInAverage } from "./categories";
import type { LedgerCategory } from "./ledger";
import type { MonthKey } from "./months";

export type MonthCategoryTotals = { month: MonthKey; byCategory: { category: LedgerCategory; totalCents: number }[] };

/**
 * Average monthly spending: for each category counted in the average (all but occasional ones), the mean over the months in which it had
 * spending (so months without data don't lower it), then summed. Mirrors the spreadsheet's "Gastos mensuales".
 */
export function averageMonthlySpending(months: MonthCategoryTotals[]) {
  const totals = new Map<string, { category: LedgerCategory; sumCents: number; monthsWithData: number }>();
  for (const month of months) {
    for (const { category, totalCents } of month.byCategory) {
      if (!countsInAverage(category) || totalCents <= 0) continue;
      const current = totals.get(category.id) ?? { category, sumCents: 0, monthsWithData: 0 };
      current.sumCents += totalCents;
      current.monthsWithData += 1;
      totals.set(category.id, current);
    }
  }

  const byCategory = [...totals.values()]
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder)
    .map(({ category, sumCents, monthsWithData }) => ({ category, averageCents: Math.round(sumCents / monthsWithData), monthsWithData }));

  return { byCategory, totalCents: byCategory.reduce((sum, item) => sum + item.averageCents, 0) };
}
