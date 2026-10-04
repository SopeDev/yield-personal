import { monthCashFlow } from "./cash-flow";
import { monthSpendingEntries, spendingItemsOf, summarizeIncome, summarizeSpending, type LedgerCategory, type LedgerIncome, type LedgerPurchase } from "./ledger";
import { monthKeyOf, type MonthKey } from "./months";
import { occurrencesForMonth, type OccurrenceOverride, type RecurringDefinition } from "./recurring";
import { netSavingsInMonth, type SavingsMovementRecord } from "./savings";
import type { Statement } from "./statements";

/** Everything needed to summarize any month inside a loaded range. */
export type LedgerData = {
  categories: LedgerCategory[];
  purchases: LedgerPurchase[];
  incomes: LedgerIncome[];
  definitions: RecurringDefinition[];
  overrides: OccurrenceOverride[];
  statements: Statement[];
  savingsMovements: SavingsMovementRecord[];
};

export function summarizeMonth(data: LedgerData, month: MonthKey) {
  const entries = monthSpendingEntries(data.purchases, month);
  const occurrences = occurrencesForMonth(data.definitions, data.overrides, month);
  const spending = summarizeSpending(
    [...spendingItemsOf(entries), ...occurrences.map((occurrence) => ({ categoryId: occurrence.recurring.category.id, amountCents: occurrence.amountCents }))],
    data.categories,
  );
  const incomes = data.incomes.filter((income) => monthKeyOf(income.date) === month);
  const income = summarizeIncome(incomes, spending.carCents);
  const savingsNetCents = netSavingsInMonth(data.savingsMovements, month);
  const cashFlow = monthCashFlow({ month, purchases: data.purchases, occurrences, statements: data.statements, savingsNetCents });

  return {
    month,
    entries,
    incomes,
    occurrences,
    spending,
    income,
    savingsNetCents,
    cashFlow,
    /** As in the spreadsheet: income minus everything paid out this month. */
    balanceCents: income.totalCents - cashFlow.toPayCents,
  };
}

export type MonthSummary = ReturnType<typeof summarizeMonth>;
