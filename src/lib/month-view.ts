import "server-only";

import { monthCashFlow } from "@/lib/cash-flow";
import { earliestContributingMonth } from "@/lib/installments";
import { getOccurrenceOverrides, getRecurringDefinitions, getStatements } from "@/lib/ledger-data";
import { monthSpendingEntries, spendingItemsOf, summarizeIncome, summarizeSpending } from "@/lib/ledger";
import { addMonths, type MonthKey } from "@/lib/months";
import { getCategories, getMonthIncomes, getPurchasesReachingMonth } from "@/lib/queries";
import { occurrencesForMonth } from "@/lib/recurring";

/** Statements due in a month close that month or the month before; their purchases reach back one installment span further. */
const STATEMENT_LOOKBACK_MONTHS = 2;

export async function loadMonthView(userId: string, month: MonthKey) {
  const definitions = await getRecurringDefinitions(userId);
  const [categories, purchases, incomes, overrides, { cards, statements }] = await Promise.all([
    getCategories(userId),
    getPurchasesReachingMonth(userId, month),
    getMonthIncomes(userId, month),
    getOccurrenceOverrides(userId, month, month),
    getStatements(userId, {
      purchasesFrom: earliestContributingMonth(addMonths(month, -STATEMENT_LOOKBACK_MONTHS)),
      recurringFrom: addMonths(month, -STATEMENT_LOOKBACK_MONTHS),
      recurringTo: addMonths(month, 1),
      definitions,
    }),
  ]);

  const entries = monthSpendingEntries(purchases, month);
  const occurrences = occurrencesForMonth(definitions, overrides, month);
  const spending = summarizeSpending(
    [...spendingItemsOf(entries), ...occurrences.map((occurrence) => ({ categoryId: occurrence.recurring.category.id, amountCents: occurrence.amountCents }))],
    categories,
  );
  const income = summarizeIncome(incomes, spending.carCents);
  const cashFlow = monthCashFlow({ month, purchases, occurrences, statements });

  return { categories, cards, entries, incomes, occurrences, statements, spending, income, cashFlow };
}
