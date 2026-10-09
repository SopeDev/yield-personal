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

/**
 * Only the records in one currency, so totals never mix currencies. Records without a currency (made before
 * currencies existed) count as `mainCurrency`. Categories, income groups, and recurring history apply to all.
 */
export function forCurrency(data: LedgerData, currency: string, mainCurrency: string): LedgerData {
  const inCurrency = (value: string | undefined) => (value ?? mainCurrency) === currency;
  return {
    ...data,
    purchases: data.purchases.filter((purchase) => inCurrency(purchase.paymentMethod.currency)),
    definitions: data.definitions.filter((definition) => inCurrency(definition.paymentMethod.currency)),
    incomes: data.incomes.filter((income) => inCurrency(income.currency)),
    statements: data.statements.filter((statement) => inCurrency(statement.currency)),
    savingsMovements: data.savingsMovements.filter((movement) => inCurrency(movement.currency)),
  };
}

/** Every currency the records use, the main one first. */
export function currenciesIn(data: LedgerData, mainCurrency: string) {
  const used = new Set([
    ...data.purchases.map((purchase) => purchase.paymentMethod.currency),
    ...data.definitions.map((definition) => definition.paymentMethod.currency),
    ...data.incomes.map((income) => income.currency),
    ...data.statements.map((statement) => statement.currency),
    ...data.savingsMovements.map((movement) => movement.currency),
  ].map((value) => value ?? mainCurrency));
  return [mainCurrency, ...[...used].filter((currency) => currency !== mainCurrency).sort()];
}

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
