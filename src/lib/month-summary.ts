import { monthCashFlow } from "./cash-flow";
import { monthSpendingEntries, spendingAmountsOf, summarizeIncome, summarizeSpending, type LedgerCategory, type LedgerIncome, type LedgerIncomeGroup, type LedgerPurchase } from "./ledger";
import { monthKeyOf, type MonthKey } from "./months";
import { occurrencesForMonth, unpaidCashOccurrences, type ConfirmedAmount, type OccurrenceOverride, type RecurringDefinition } from "./recurring";
import { netSavingsInMonth, type SavingsMovementRecord } from "./savings";
import type { Statement } from "./statements";

/** Everything needed to summarize any month inside a loaded range. */
export type LedgerData = {
  categories: LedgerCategory[];
  purchases: LedgerPurchase[];
  incomes: LedgerIncome[];
  /** Income groups, including archived ones, so past months still net their income. */
  incomeGroups: LedgerIncomeGroup[];
  definitions: RecurringDefinition[];
  overrides: OccurrenceOverride[];
  /** Confirmed recurring amounts by item, for estimating variable bills. */
  recurringHistory: ConfirmedAmount[];
  statements: Statement[];
  savingsMovements: SavingsMovementRecord[];
};

export function summarizeMonth(data: LedgerData, month: MonthKey, { carryFrom }: { carryFrom?: MonthKey } = {}) {
  const entries = monthSpendingEntries(data.purchases, month);
  const occurrences = occurrencesForMonth(data.definitions, data.overrides, month, data.recurringHistory);
  const spending = summarizeSpending(
    [...spendingAmountsOf(entries), ...occurrences.map((occurrence) => ({ item: occurrence.recurring.item, amountCents: occurrence.amountCents }))],
    data.categories,
  );
  const incomes = data.incomes.filter((income) => monthKeyOf(income.date) === month);
  const income = summarizeIncome(incomes, { groups: data.incomeGroups, spendingByCategory: spending.byCategory });
  const savingsNetCents = netSavingsInMonth(data.savingsMovements, month);
  const carriedOccurrences = carryFrom ? unpaidCashOccurrences(data.definitions, data.overrides, carryFrom, month, data.recurringHistory) : [];
  const cashFlow = monthCashFlow({ month, purchases: data.purchases, occurrences, statements: data.statements, savingsNetCents, carryFrom, carriedOccurrences });

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
