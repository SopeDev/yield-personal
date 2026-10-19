import "server-only";

import { averageMonthlySpending } from "@/lib/averages";
import { DAYS_PER_MONTH, incomePace, RARE_LOOKBACK_MONTHS, todaySoFar, typicalDailySpending } from "@/lib/daily-balance";
import { addDays, billEvents, cardStatementEvents, expectedIncomeEvents, FORECAST_DAYS, forecastCash, monthOfKey, paydayEvents, plannedPurchaseEvents } from "@/lib/forecast";
import { getCashWallets, getExchanges, getRecurringIncomes, getSavingsFunds, loadCashOnHand, loadLedgerRange } from "@/lib/ledger-data";
import { getMainCurrency, getStatNames, getUserSettings } from "@/lib/queries";
import { cardLayout, monthStatContext, type OtherCash, type SavingsSnapshot, type StatRef, type SummaryCardId } from "@/lib/stats";
import { currenciesIn, forCurrency, summarizeMonth, type MonthSummary } from "@/lib/month-summary";
import { db } from "@/db/client";
import { addMonths, dateKeyOf, monthDifference, monthKeyOf, type MonthKey } from "@/lib/months";
import { occurrencesForMonth, unpaidCashOccurrences } from "@/lib/recurring";
import { expectedPaydays, recurringIncomeRhythmOf } from "@/lib/recurring-income";
import { emergencyFundGoal, fundBalance } from "@/lib/savings";
import { DEPOSIT_MATCH_DAYS, depositDays, matchDeposits, projectSavings, type DepositMade, type GrowingFund } from "@/lib/savings-growth";
import { installmentsOwed } from "@/lib/statements";
import { convertCents, type ExchangeRates } from "@/lib/currency-conversion";
import { formatCents } from "@/lib/money";
import { loadExchangeRates } from "@/lib/exchange-rates";

/** The year view and averages cover the last 12 months, ending with the given month. */
export const YEAR_MONTHS = 12;

/** How far back unpaid card statements and cash bills are carried into the current month. */
export const CARRY_UNPAID_MONTHS = 12;

/**
 * The current month also carries unpaid statements and cash bills from earlier months; other months show only
 * their own. Recent purchases and incomes are loaded too, for typical daily spending and the pace of work.
 *
 * Records are never converted: the month's figures (and `purchases`, for typical spending) are the main
 * currency's, `lists` holds the records of every currency to list them, and `others` totals each other currency.
 * Recurring income's paydays are listed in every currency; only the main currency's are expected in the figures.
 */
export async function loadMonthView(userId: string, month: MonthKey, currentMonth: MonthKey) {
  const carryFrom = month === currentMonth ? addMonths(month, -CARRY_UNPAID_MONTHS) : undefined;
  const [{ data, cards }, currency, exchanges, recurringIncomes] = await Promise.all([
    loadLedgerRange(userId, month, month, { statementsFrom: carryFrom, purchasesFrom: addMonths(currentMonth, -RARE_LOOKBACK_MONTHS) }),
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
    // One-off income expected this month in the main currency (like a client's payment), counted as coming.
    expectedIncomes: (main.data.expectedIncomes ?? []).filter((income) => monthKeyOf(income.date) === month),
    lists: {
      entries: newestFirst(summaries.flatMap((summary) => summary.entries), (entry) => entry.purchase.date),
      incomes: newestFirst(summaries.flatMap((summary) => summary.incomes), (income) => income.date),
      expectedIncomes: (data.expectedIncomes ?? []).filter((income) => monthKeyOf(income.date) === month),
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

/**
 * Money on hand in the main currency: its own wallet plus the other currencies' wallets counted at today's rate
 * (`otherCash` lists them; one with no rate known is only noted). Null when no wallet that counts in it is set.
 */
export function splitCash(balances: Awaited<ReturnType<typeof loadCashOnHand>>, mainCurrency: string, rates: ExchangeRates = new Map()) {
  const counted = balances.flatMap(({ wallet, cents }) => (cents === null ? [] : [{ currency: wallet.currency, cents }]));
  const mainCents = counted.find((cash) => cash.currency === mainCurrency)?.cents ?? null;
  const otherCash: OtherCash[] = counted.filter((cash) => cash.currency !== mainCurrency).map((cash) => {
    const rate = rates.get(cash.currency);
    return rate ? { ...cash, converted: { cents: convertCents(cash.cents, rate.rate), rate: rate.rate, date: rate.date } } : cash;
  });
  const convertedCents = otherCash.reduce((sum, cash) => sum + (cash.converted?.cents ?? 0), 0);
  const anyConverted = otherCash.some((cash) => cash.converted);
  return {
    cashOnHandCents: mainCents === null && !anyConverted ? null : (mainCents ?? 0) + convertedCents,
    cashOnHandParts: balances.find(({ wallet }) => wallet.currency === mainCurrency)?.parts ?? null,
    otherCash,
  };
}

/** Money on hand now (`splitCash`), with today's rates for the wallets in other currencies. */
export async function loadCash(userId: string, wallets: Awaited<ReturnType<typeof getCashWallets>>, mainCurrency: string) {
  const [balances, rates] = await Promise.all([
    loadCashOnHand(userId, wallets),
    loadExchangeRates(mainCurrency, wallets.map((wallet) => wallet.currency)),
  ]);
  return splitCash(balances, mainCurrency, rates);
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
    shows("cashOnHand") ? loadCash(userId, wallets, settings.currency) : { cashOnHandCents: null, cashOnHandParts: null, otherCash: [] },
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

/**
 * Average monthly spending over the given months, skipping those before `historyStart` (they may hold only partial
 * records), without `excludeCategoryIds`.
 */
function averageSince(months: MonthSummary[], historyStart: MonthKey | null, excludeCategoryIds: string[] = []) {
  return averageMonthlySpending(
    months.filter((month) => !historyStart || month.month >= historyStart).map((month) => ({ month: month.month, byCategory: month.spending.byCategory })),
    { excludeCategoryIds },
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
  // The emergency fund covers living without income, so the costs of working (the categories income groups deduct,
  // like gas for rideshare) stay out: they stop with the work, as days off count them.
  const workCategoryIds = [...new Set(data.incomeGroups.flatMap((group) => group.deductCategoryIds))];
  const average = averageSince(months, historyStartMonth, workCategoryIds);
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

/**
 * Savings now in the main currency, for the savings stat: each fund's balance and goal, as on the Savings page, with
 * funds in other currencies counted at today's rate (one with no rate known is left out).
 */
export async function loadSavingsSnapshot(userId: string, currentMonth: MonthKey, mainCurrency: string): Promise<SavingsSnapshot> {
  const { funds, installmentsOwedCents } = await loadSavingsView(userId, currentMonth);
  const rates = await loadExchangeRates(mainCurrency, funds.map((fund) => fund.currency));
  const counted = funds.flatMap((fund) => {
    if (fund.currency === mainCurrency) return [{ ...fund, original: null as { currency: string; cents: number } | null }];
    const rate = rates.get(fund.currency);
    if (!rate) return [];
    // The emergency fund's goal is worked out in the main currency already; a goal fund's target is in its own.
    const goalCents = fund.kind === "EMERGENCY" ? fund.goalCents : convertCents(fund.goalCents, rate.rate);
    return [{ ...fund, balanceCents: convertCents(fund.balanceCents, rate.rate), goalCents, original: { currency: fund.currency, cents: fund.balanceCents } }];
  });
  const emergency = counted.find((fund) => fund.kind === "EMERGENCY");
  return {
    funds: counted.map(({ kind, name, balanceCents, goalCents, original }) => ({ kind, name, balanceCents, goalCents, ...(original ? { original } : {}) })),
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
    loadLedgerRange(userId, currentMonth, endMonth, { statementsFrom: addMonths(currentMonth, -CARRY_UNPAID_MONTHS), purchasesFrom: addMonths(currentMonth, -RARE_LOOKBACK_MONTHS) }),
    getUserSettings(userId),
    getCashWallets(userId),
    getRecurringIncomes(userId),
  ]);
  const currency = settings.currency;
  const { cashOnHandCents, otherCash } = await loadCash(userId, wallets, currency);
  if (cashOnHandCents === null) return null;

  const data = forCurrency(allData, currency, currency);
  const historyStart = settings.historyFrom ?? settings.historyStartMonth;
  const recurringIncomes = allRecurringIncomes.filter((recurring) => (recurring.currency ?? currency) === currency);
  const recurringSourceIds = new Set(recurringIncomes.map((recurring) => recurring.source.id));
  // Recurring income arrives on its paydays, so the pace leaves it out, as the month's projection does.
  const paceIncomes = data.incomes.filter((income) => !income.recurringIncomeId && !recurringSourceIds.has(income.source.id));
  const pace = incomePace({ incomes: paceIncomes, today, historyStart, estimateMonthlyCents: settings.estimates.incomeMonthlyCents });
  const cashPurchases = data.purchases.filter((purchase) => purchase.paymentMethod.kind === "CASH");
  // Estimates don't say what's paid in cash and what by card, so while they count, all of the estimate is spent in
  // cash and every payment method's records count only in the share the records have (together they come to the
  // blended typical day).
  const { estimateShare, estimateMonthlyCents } = typicalDailySpending({ purchases: data.purchases, today, historyStart, estimates: settings.estimates.spending });
  const recordsShare = (cents: number) => Math.round(cents * (1 - estimateShare));
  const cashTypical = typicalDailySpending({ purchases: cashPurchases, today, historyStart });
  const cashDaily = { ...cashTypical, cents: recordsShare(cashTypical.realCents) + Math.round((estimateMonthlyCents / DAYS_PER_MONTH) * estimateShare) };
  // Cash planned for today is one of the day's events, so what today has spent so far is only what's confirmed.
  const todays = todaySoFar({ purchases: cashPurchases.filter((purchase) => !purchase.planned), incomes: paceIncomes, today });

  const months = Array.from({ length: monthDifference(currentMonth, endMonth) + 1 }, (_, index) => addMonths(currentMonth, index));
  const occurrencesOf = (ledger: typeof data) => [
    // Cash bills left unpaid in earlier months are owed now.
    ...unpaidCashOccurrences(ledger.definitions, ledger.overrides, addMonths(currentMonth, -CARRY_UNPAID_MONTHS), currentMonth, ledger.recurringHistory),
    ...months.flatMap((month) => occurrencesForMonth(ledger.definitions, ledger.overrides, month, ledger.recurringHistory)),
  ];
  const occurrences = occurrencesOf(data);
  // Cash bills in other currencies are paid from those wallets, which count in cash at today's rate: they leave it
  // the same way, converted (one in a currency with no rate known is left out, like its wallet).
  const otherCurrencies = currenciesIn(allData, currency).filter((code) => code !== currency);
  const billRates = await loadExchangeRates(currency, otherCurrencies);
  const otherBillEvents = otherCurrencies.flatMap((code) => {
    const rate = billRates.get(code);
    if (!rate) return [];
    return billEvents(occurrencesOf(forCurrency(allData, code, currency)), { today, end }).map((event) => ({
      event: { ...event, label: `${event.label} (${formatCents(-event.cents, code, true)})`, cents: -convertCents(-event.cents, rate.rate) },
      conversion: { currency: code, rate: rate.rate, date: rate.date },
    }));
  });
  const cardEvents = cards
    .filter((card) => (card.currency ?? currency) === currency && card.closingDay != null && card.paymentDays != null)
    .flatMap((card) => {
      const onCard = data.purchases.filter((purchase) => purchase.paymentMethod.id === card.id);
      return cardStatementEvents({
        today,
        end,
        card: {
          id: card.id, name: card.name, closingDay: card.closingDay!, paymentDays: card.paymentDays!, archived: card.archivedAt !== null,
          dailyCents: recordsShare(typicalDailySpending({ purchases: onCard, today, historyStart }).realCents),
          todaySpentCents: todaySoFar({ purchases: onCard, incomes: [], today }).spentCents,
        },
        statements: data.statements,
      });
    });
  const events = [
    ...billEvents(occurrences, { today, end }),
    ...otherBillEvents.map(({ event }) => event),
    ...cardEvents,
    ...paydayEvents(months.flatMap((month) => expectedPaydays(recurringIncomes, data.incomes, month)), { today, end }),
    ...plannedPurchaseEvents(data.purchases, { today, end }),
    // Expected one-off income on its day, taking the place of its source's share of the pace that day.
    ...expectedIncomeEvents(data.expectedIncomes ?? [], {
      today, end,
      sourcePaceCents: (sourceId) => incomePace({ incomes: paceIncomes.filter((income) => income.source.id === sourceId), today, historyStart }).cents,
      inPace: (sourceId) => !recurringSourceIds.has(sourceId),
    }),
  ];

  // Savings grow beside cash: planned deposits leave cash on their days, and interest adds up on the funds.
  const funds = await growingFunds(userId, currency, today);
  const savings = projectSavings({ today, days: FORECAST_DAYS, funds });
  const cash = forecastCash({
    today, startCents: cashOnHandCents, paceDailyCents: pace.cents, cashDailyCents: cashDaily.cents,
    todayIncomeCents: todays.incomeCents, todayCashSpentCents: todays.spentCents, events: [...events, ...savings.events],
  });

  return {
    currency,
    ...cash,
    // Cash plus savings each day, with the interest earned so far; none without savings.
    savings: funds.length === 0 ? null : savings.days,
    funds,
    startCents: cashOnHandCents,
    // Other currencies counted at today's rate, in cash and in savings, to say so.
    converted: conversionsUsed([
      ...otherCash.flatMap((cash) => (cash.converted ? [{ currency: cash.currency, rate: cash.converted.rate, date: cash.converted.date }] : [])),
      ...funds.flatMap((fund) => (fund.converted ? [fund.converted] : [])),
      ...otherBillEvents.map(({ conversion }) => conversion),
    ]),
    paceDailyCents: pace.cents,
    cashDailyCents: cashDaily.cents,
    historyDays: pace.days,
  };
}

/** Each currency converted once, by code. */
function conversionsUsed(conversions: { currency: string; rate: number; date: string }[]) {
  return [...new Map(conversions.map((conversion) => [conversion.currency, conversion])).values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * The savings funds as the forecast grows them, in the main currency: each one's balance now (from all its
 * movements), its interest rates, and its planned deposit (with the days a deposit already made). Funds in other
 * currencies are counted at today's rate; one with no rate known is left out.
 */
async function growingFunds(userId: string, currency: string, today: string): Promise<(GrowingFund & { converted?: { currency: string; rate: number; date: string } })[]> {
  const all = await getSavingsFunds(userId);
  const rates = await loadExchangeRates(currency, all.map((fund) => fund.currency));
  const funds = all.filter((fund) => fund.currency === currency || rates.has(fund.currency));
  if (funds.length === 0) return [];
  const movements = await db.savingsMovement.findMany({ where: { userId, fundId: { in: funds.map((fund) => fund.id) } }, select: { fundId: true, amountCents: true, date: true } });
  return funds.map((fund) => {
    const own = movements.filter((movement) => movement.fundId === fund.id);
    const rate = fund.currency === currency ? null : rates.get(fund.currency)!;
    const inMain = (cents: number) => (rate ? convertCents(cents, rate.rate) : cents);
    const rhythm = fund.depositRhythm && fund.depositCents
      ? recurringIncomeRhythmOf({ kind: fund.depositRhythm, anchor: fund.depositAnchor ? dateKeyOf(fund.depositAnchor) : null, days: fund.depositDays })
      : null;
    const made = rhythm ? [...matchDeposits(
      depositDays(rhythm, addDays(today, -DEPOSIT_MATCH_DAYS.after), addDays(today, FORECAST_DAYS)),
      own.map((movement) => ({ date: dateKeyOf(movement.date), amountCents: movement.amountCents })),
      fund.depositCents ?? undefined,
    )] : [];
    return {
      id: fund.id,
      // The emergency fund's name is shown in the interface's language.
      name: fund.kind === "EMERGENCY" ? "" : (fund.name ?? ""),
      balanceCents: inMain(own.reduce((sum, movement) => sum + movement.amountCents, 0)),
      rateBps: fund.interestRateBps,
      rateUntil: fund.interestUntil ? dateKeyOf(fund.interestUntil) : null,
      afterBps: fund.interestAfterBps,
      deposit: rhythm && fund.depositCents ? { cents: inMain(fund.depositCents), rhythm } : null,
      // Planned days from a little before today on that deposits already made (matched in the fund's own currency), so
      // they aren't moved again, and those partly made, which move only the rest.
      doneDates: made.flatMap(([day, match]) => (match?.complete ? [day] : [])),
      partlyMade: Object.fromEntries(made.flatMap(([day, match]) => (match && !match.complete ? [[day, inMain(match.amountCents)]] : []))),
      ...(rate ? { converted: { currency: fund.currency, rate: rate.rate, date: rate.date } } : {}),
    };
  });
}

/** A planned deposit's day in a month, and what has gone in for it (all of it, or part), if anything has. */
export type PlannedDepositRow = { fundId: string; fundName: string; currency: string; date: string; plannedCents: number; made: DepositMade | null };

/**
 * The month's planned deposits into savings, by day, each with the deposit that made it (`matchDeposits`). Only the
 * current month and later ones: a plan says nothing about months before it.
 */
export async function loadPlannedDeposits(userId: string, month: MonthKey, currentMonth: MonthKey): Promise<PlannedDepositRow[]> {
  if (month < currentMonth) return [];
  const funds = (await getSavingsFunds(userId)).filter((fund) => fund.depositRhythm && fund.depositCents);
  if (funds.length === 0) return [];
  const movements = await db.savingsMovement.findMany({ where: { userId, fundId: { in: funds.map((fund) => fund.id) } }, select: { fundId: true, amountCents: true, date: true } });
  const from = `${month}-01`;
  const to = addDays(addMonths(month, 1) + "-01", -1);
  return funds.flatMap((fund) => {
    const rhythm = recurringIncomeRhythmOf({ kind: fund.depositRhythm!, anchor: fund.depositAnchor ? dateKeyOf(fund.depositAnchor) : null, days: fund.depositDays });
    if (!rhythm) return [];
    const own = movements.filter((movement) => movement.fundId === fund.id).map((movement) => ({ date: dateKeyOf(movement.date), amountCents: movement.amountCents }));
    return [...matchDeposits(depositDays(rhythm, from, to), own, fund.depositCents!)].map(([date, made]) => ({
      fundId: fund.id,
      fundName: fund.kind === "EMERGENCY" ? "" : (fund.name ?? ""),
      currency: fund.currency,
      date,
      plannedCents: fund.depositCents!,
      made,
    }));
  }).sort((a, b) => a.date.localeCompare(b.date));
}
