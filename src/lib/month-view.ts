import "server-only";

import { averageMonthlySpending } from "@/lib/averages";
import { TYPICAL_SPENDING_MONTHS } from "@/lib/daily-balance";
import { getCashWallets, getExchanges, getRecurringIncomes, getSavingsFunds, loadCashOnHand, loadLedgerRange } from "@/lib/ledger-data";
import { getMainCurrency, getUserSettings } from "@/lib/queries";
import { cardLayout, monthStatContext, type SummaryCardId } from "@/lib/stats";
import { currenciesIn, forCurrency, summarizeMonth, type MonthSummary } from "@/lib/month-summary";
import { addMonths, type MonthKey } from "@/lib/months";
import { expectedPaydays } from "@/lib/recurring-income";
import { emergencyFundGoal, fundBalance } from "@/lib/savings";
import { installmentsOwed } from "@/lib/statements";

/** The year view and averages cover the last 12 months, ending with the given month. */
export const YEAR_MONTHS = 12;

/** How far back unpaid card statements and cash bills are carried into the current month. */
export const CARRY_UNPAID_MONTHS = 12;

/**
 * The current month also carries unpaid statements and cash bills from earlier months; other months show only
 * their own. Recent purchases and incomes are loaded too, for typical daily spending and the pace of work.
 *
 * Currencies are never converted: the month's figures (and `purchases`, for typical spending) are the main
 * currency's, `lists` holds the records of every currency to list them, and `others` totals each other currency.
 * Recurring income's paydays are listed in every currency; only the main currency's are expected in the figures.
 */
export async function loadMonthView(userId: string, month: MonthKey, currentMonth: MonthKey) {
  const carryFrom = month === currentMonth ? addMonths(month, -CARRY_UNPAID_MONTHS) : undefined;
  const [{ data, cards }, currency, exchanges, recurringIncomes] = await Promise.all([
    loadLedgerRange(userId, month, month, { statementsFrom: carryFrom, purchasesFrom: addMonths(currentMonth, -TYPICAL_SPENDING_MONTHS) }),
    getMainCurrency(userId),
    getExchanges(userId, month),
    getRecurringIncomes(userId),
  ]);
  const byCurrency = currenciesIn(data, currency).map((code) => {
    const currencyData = forCurrency(data, code, currency);
    return { currency: code, data: currencyData, summary: summarizeMonth(currencyData, month, { carryFrom }) };
  });
  const [main, ...others] = byCurrency;
  const summaries = byCurrency.map((entry) => entry.summary);
  const newestFirst = <T,>(items: T[], date: (item: T) => Date) => items.sort((a, b) => date(b).getTime() - date(a).getTime());
  const byClosingDate = (a: { closingDate: Date }, b: { closingDate: Date }) => a.closingDate.getTime() - b.closingDate.getTime();

  return {
    ...main.summary,
    currency,
    cards,
    statements: data.statements,
    purchases: main.data.purchases,
    recentIncomes: main.data.incomes,
    recurringIncomes: recurringIncomes.filter((recurring) => (recurring.currency ?? currency) === currency),
    lists: {
      entries: newestFirst(summaries.flatMap((summary) => summary.entries), (entry) => entry.purchase.date),
      incomes: newestFirst(summaries.flatMap((summary) => summary.incomes), (income) => income.date),
      occurrences: summaries.flatMap((summary) => summary.occurrences)
        .sort((a, b) => a.recurring.dayOfMonth - b.recurring.dayOfMonth || a.recurring.item.name.localeCompare(b.recurring.item.name)),
      statementsClosing: summaries.flatMap((summary) => summary.cashFlow.statementsClosing).sort(byClosingDate),
      carriedStatements: summaries.flatMap((summary) => summary.cashFlow.carriedStatements).sort(byClosingDate),
      carriedOccurrences: summaries.flatMap((summary) => summary.cashFlow.carriedOccurrences),
      exchanges,
      expectedPaydays: expectedPaydays(recurringIncomes, data.incomes, month),
    },
    others: others.map(({ currency: code, summary }) => ({
      currency: code,
      incomeCents: summary.income.totalCents,
      spendingCents: summary.spending.totalCents,
      toPayCents: summary.cashFlow.toPayCents,
      outstandingCents: summary.cashFlow.outstandingCents + summary.cashFlow.carriedOutstandingCents,
    })),
  };
}

/** Money on hand split into the main currency's wallet (the stat) and the other currencies' (noted beside it). */
export function splitCash(balances: Awaited<ReturnType<typeof loadCashOnHand>>, mainCurrency: string) {
  const counted = balances.flatMap(({ wallet, cents }) => (cents === null ? [] : [{ currency: wallet.currency, cents }]));
  return {
    cashOnHandCents: counted.find((cash) => cash.currency === mainCurrency)?.cents ?? null,
    cashOnHandParts: balances.find(({ wallet }) => wallet.currency === mainCurrency)?.parts ?? null,
    otherCash: counted.filter((cash) => cash.currency !== mainCurrency),
  };
}

/**
 * Settings, plus money on hand when the customized summary card shows it. Money on hand takes its own queries, so
 * it is loaded only then, starting as soon as settings and wallets arrive, alongside the month's figures.
 */
export async function loadCardSettings(userId: string, card: SummaryCardId) {
  const [settings, wallets] = await Promise.all([getUserSettings(userId), getCashWallets(userId)]);
  const stored = settings.summaryCards[card];
  const showsCash = stored !== undefined && [stored.headline, ...stored.grid].includes("cashOnHand");
  return { settings, ...(showsCash ? splitCash(await loadCashOnHand(userId, wallets), settings.currency) : { cashOnHandCents: null, cashOnHandParts: null, otherCash: [] }) };
}

/** A summary card's layout (customized or default) and the figures it is calculated from. */
export function summaryCardFor(card: SummaryCardId, { view, today, settings, cashOnHandCents, cashOnHandParts, otherCash }: {
  view: Awaited<ReturnType<typeof loadMonthView>>;
  today: string;
} & Awaited<ReturnType<typeof loadCardSettings>>) {
  const context = monthStatContext({ view, today, settings, cashOnHandCents, cashOnHandParts, otherCash });
  return { context, layout: cardLayout(card, settings.summaryCards, context) };
}

/** Average monthly spending over the given months, skipping those before `historyStart` (they may hold only partial records). */
function averageSince(months: MonthSummary[], historyStart: MonthKey | null) {
  return averageMonthlySpending(
    months.filter((month) => !historyStart || month.month >= historyStart).map((month) => ({ month: month.month, byCategory: month.spending.byCategory })),
  );
}

/** The year in the main currency (records in other currencies aren't converted into it). */
export async function loadYearView(userId: string, endMonth: MonthKey) {
  const startMonth = addMonths(endMonth, -(YEAR_MONTHS - 1));
  const [{ data: allData }, currency] = await Promise.all([loadLedgerRange(userId, startMonth, endMonth), getMainCurrency(userId)]);
  const data = forCurrency(allData, currency, currency);
  const months = Array.from({ length: YEAR_MONTHS }, (_, index) => summarizeMonth(data, addMonths(startMonth, index)));
  // Savings funds keep their own currencies, so their movements stay whole.
  return { data, categories: data.categories, months, currency, allSavingsMovements: allData.savingsMovements };
}

/** Savings funds with balances, and the emergency fund goal from average spending and installments owed. */
export async function loadSavingsView(userId: string, currentMonth: MonthKey) {
  const [{ data, months, allSavingsMovements }, funds, { historyStartMonth }] = await Promise.all([loadYearView(userId, currentMonth), getSavingsFunds(userId), getUserSettings(userId)]);
  const average = averageSince(months, historyStartMonth);
  const installmentsOwedCents = installmentsOwed(data.statements);

  return {
    average,
    months,
    installmentsOwedCents,
    movements: allSavingsMovements,
    // Each fund's balance is in its own currency; the emergency fund's goal is in the main currency.
    funds: funds.map((fund) => {
      const balanceCents = fundBalance(allSavingsMovements, fund.id);
      const goal = fund.kind === "EMERGENCY"
        ? emergencyFundGoal({ averageMonthlyCents: average.totalCents, coverMonths: fund.coverMonths, installmentsOwedCents, balanceCents })
        : { emergencyCents: 0, goalCents: fund.targetCents ?? 0, pendingCents: Math.max(0, (fund.targetCents ?? 0) - balanceCents) };
      return { ...fund, balanceCents, ...goal };
    }),
  };
}
