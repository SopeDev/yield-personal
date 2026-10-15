import "server-only";

import { averageMonthlySpending } from "@/lib/averages";
import { incomePace, todaySoFar, TYPICAL_SPENDING_MONTHS, typicalDailySpending } from "@/lib/daily-balance";
import { addDays, billEvents, cardStatementEvents, FORECAST_DAYS, forecastCash, monthOfKey, paydayEvents } from "@/lib/forecast";
import { getCashWallets, getExchanges, getRecurringIncomes, getSavingsFunds, loadCashOnHand, loadLedgerRange } from "@/lib/ledger-data";
import { getMainCurrency, getStatNames, getUserSettings } from "@/lib/queries";
import { cardLayout, monthStatContext, type SavingsSnapshot, type StatRef, type SummaryCardId } from "@/lib/stats";
import { currenciesIn, forCurrency, summarizeMonth, type MonthSummary } from "@/lib/month-summary";
import { addMonths, monthDifference, type MonthKey } from "@/lib/months";
import { occurrencesForMonth, unpaidCashOccurrences } from "@/lib/recurring";
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
    incomeGroupDefs: main.data.incomeGroups,
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
 * Settings, plus money on hand, savings, and category and item names when the customized summary card shows stats that need them. Each takes its own queries
 * (savings, a year of spending for the emergency fund's goal), so it is loaded only then, starting as soon as
 * settings arrive, alongside the month's figures.
 */
export async function loadCardSettings(userId: string, card: SummaryCardId, currentMonth: MonthKey) {
  const [settings, wallets] = await Promise.all([getUserSettings(userId), getCashWallets(userId)]);
  const stored = settings.summaryCards[card];
  const shows = (stat: StatRef) => stored !== undefined && [stored.headline, ...stored.grid].includes(stat);
  // Configurable stats name categories, items, and sources (a stat about one with no records lately still has its name).
  const showsConfigurable = stored !== undefined && [stored.headline, ...stored.grid].some((ref) => ref.includes(":"));
  const [cash, savings, statNames] = await Promise.all([
    shows("cashOnHand") ? loadCashOnHand(userId, wallets).then((balances) => splitCash(balances, settings.currency)) : { cashOnHandCents: null, cashOnHandParts: null, otherCash: [] },
    shows("savings") ? loadSavingsSnapshot(userId, currentMonth, settings.currency) : null,
    showsConfigurable ? getStatNames(userId) : null,
  ]);
  return { settings, ...cash, savings, statNames };
}

/** A summary card's layout (customized or default) and the figures it is calculated from. */
export function summaryCardFor(card: SummaryCardId, { view, today, settings, cashOnHandCents, cashOnHandParts, otherCash, savings, statNames }: {
  view: Awaited<ReturnType<typeof loadMonthView>>;
  today: string;
} & Awaited<ReturnType<typeof loadCardSettings>>) {
  const context = monthStatContext({ view, today, settings, cashOnHandCents, cashOnHandParts, otherCash, savings, statNames });
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

/** Savings in the main currency now, for the savings stat: each fund's balance and goal, as on the Savings page. */
export async function loadSavingsSnapshot(userId: string, currentMonth: MonthKey, mainCurrency: string): Promise<SavingsSnapshot> {
  const { funds, installmentsOwedCents } = await loadSavingsView(userId, currentMonth);
  const main = funds.filter((fund) => fund.currency === mainCurrency);
  const emergency = main.find((fund) => fund.kind === "EMERGENCY");
  return {
    funds: main.map(({ kind, name, balanceCents, goalCents }) => ({ kind, name, balanceCents, goalCents })),
    emergency: emergency ? { coverMonths: emergency.coverMonths, emergencyCents: emergency.emergencyCents, installmentsOwedCents } : null,
  };
}

/**
 * Cash on hand day by day for the next `FORECAST_DAYS` (main currency): today's cash, the recent pace of income less
 * typical everyday cash spending each day, and on their dates the cash bills still to pay (unpaid ones from earlier
 * months on today), each card's statements on their due dates (what's charged plus the card's typical everyday
 * spending for the days still to come), and recurring income still expected. Null without a counted cash wallet.
 */
export async function loadForecast(userId: string, today: string) {
  const currentMonth = monthOfKey(today);
  const end = addDays(today, FORECAST_DAYS);
  const endMonth = monthOfKey(end);
  const [{ data: allData, cards }, settings, wallets, allRecurringIncomes] = await Promise.all([
    loadLedgerRange(userId, currentMonth, endMonth, { statementsFrom: addMonths(currentMonth, -CARRY_UNPAID_MONTHS), purchasesFrom: addMonths(currentMonth, -TYPICAL_SPENDING_MONTHS) }),
    getUserSettings(userId),
    getCashWallets(userId),
    getRecurringIncomes(userId),
  ]);
  const currency = settings.currency;
  const { cashOnHandCents } = splitCash(await loadCashOnHand(userId, wallets), currency);
  if (cashOnHandCents === null) return null;

  const data = forCurrency(allData, currency, currency);
  const historyStart = settings.historyStartMonth;
  const recurringIncomes = allRecurringIncomes.filter((recurring) => (recurring.currency ?? currency) === currency);
  const recurringSourceIds = new Set(recurringIncomes.map((recurring) => recurring.source.id));
  // Recurring income arrives on its paydays, so the pace leaves it out, as the month's projection does.
  const paceIncomes = data.incomes.filter((income) => !income.recurringIncomeId && !recurringSourceIds.has(income.source.id));
  const pace = incomePace({ incomes: paceIncomes, today, historyStart });
  const cashPurchases = data.purchases.filter((purchase) => purchase.paymentMethod.kind === "CASH");
  const cashDaily = typicalDailySpending({ purchases: cashPurchases, today, historyStart });
  const todays = todaySoFar({ purchases: cashPurchases, incomes: paceIncomes, today });

  const months = Array.from({ length: monthDifference(currentMonth, endMonth) + 1 }, (_, index) => addMonths(currentMonth, index));
  const occurrences = [
    // Cash bills left unpaid in earlier months are owed now.
    ...unpaidCashOccurrences(data.definitions, data.overrides, addMonths(currentMonth, -CARRY_UNPAID_MONTHS), currentMonth, data.recurringHistory),
    ...months.flatMap((month) => occurrencesForMonth(data.definitions, data.overrides, month, data.recurringHistory)),
  ];
  const cardEvents = cards
    .filter((card) => (card.currency ?? currency) === currency && card.closingDay != null && card.paymentDays != null)
    .flatMap((card) => {
      const onCard = data.purchases.filter((purchase) => purchase.paymentMethod.id === card.id);
      return cardStatementEvents({
        today,
        end,
        card: {
          id: card.id, name: card.name, closingDay: card.closingDay!, paymentDays: card.paymentDays!, archived: card.archivedAt !== null,
          dailyCents: typicalDailySpending({ purchases: onCard, today, historyStart }).cents,
          todaySpentCents: todaySoFar({ purchases: onCard, incomes: [], today }).spentCents,
        },
        statements: data.statements,
      });
    });
  const events = [
    ...billEvents(occurrences, { today, end }),
    ...cardEvents,
    ...paydayEvents(months.flatMap((month) => expectedPaydays(recurringIncomes, data.incomes, month)), { today, end }),
  ];

  return {
    currency,
    ...forecastCash({
      today, startCents: cashOnHandCents, paceDailyCents: pace.cents, cashDailyCents: cashDaily.cents,
      todayIncomeCents: todays.incomeCents, todayCashSpentCents: todays.spentCents, events,
    }),
    startCents: cashOnHandCents,
    paceDailyCents: pace.cents,
    cashDailyCents: cashDaily.cents,
    historyDays: pace.days,
  };
}

