import "server-only";

import { db } from "@/db/client";
import { statementsForCards } from "@/lib/card-statements";
import { cashOnHandParts, type CashCount, type CashOnHandParts, type PaidBill } from "@/lib/cash-on-hand";
import { earliestContributingMonth } from "@/lib/installments";
import type { LedgerIncomeGroup } from "@/lib/ledger";
import type { LedgerData } from "@/lib/month-summary";
import { addMonths, dateFromKey, dateKeyOf, monthKeyOf, monthRange, type MonthKey } from "@/lib/months";
import { occurrencesForMonth, type ConfirmedAmount, type OccurrenceOverride, type RecurringDefinition } from "@/lib/recurring";
import { recurringIncomeRhythmOf, type RecurringIncomeDefinition } from "@/lib/recurring-income";
import { dateKeyInAppZone, monthKeyInAppZone, todayKey } from "@/lib/today";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, kind: true } as const;
const paymentMethodSelect = { id: true, kind: true, name: true, color: true, currency: true } as const;
const itemSelect = { id: true, name: true, category: { select: categorySelect } } as const;
const purchaseSelect = {
  id: true,
  date: true,
  amountCents: true,
  note: true,
  installmentCount: true,
  item: { select: itemSelect },
  paymentMethod: { select: paymentMethodSelect },
} as const;

/** A statement closing in a month can include recurring charges from the month before (after the previous closing). */
const STATEMENT_LOOKBACK_MONTHS = 1;

/** All recurring payments, including stopped ones, so past months still show what was due. */
export async function getRecurringDefinitions(userId: string): Promise<RecurringDefinition[]> {
  const rows = await db.recurringPayment.findMany({
    where: { userId },
    select: {
      id: true, amountCents: true, isVariable: true, intervalMonths: true, dayOfMonth: true, startMonth: true, endMonth: true, createdAt: true,
      item: { select: itemSelect },
      paymentMethod: { select: paymentMethodSelect },
    },
    orderBy: [{ dayOfMonth: "asc" }, { item: { name: "asc" } }],
  });
  return rows.map(({ createdAt, ...recurring }) => ({ ...recurring, addedMonth: monthKeyInAppZone(createdAt) }));
}

/** Recurring income, with its schedule; a stored schedule that is incomplete is left out. */
export async function getRecurringIncomes(userId: string): Promise<RecurringIncomeDefinition[]> {
  const rows = await db.recurringIncome.findMany({
    where: { userId },
    select: {
      id: true, amountCents: true, currency: true, rhythm: true, anchor: true, payDays: true, startsOn: true,
      source: { select: { id: true, name: true, groupId: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows.flatMap(({ rhythm: kind, anchor, payDays, startsOn, ...recurring }) => {
    const rhythm = recurringIncomeRhythmOf({ kind, anchor: anchor ? dateKeyOf(anchor) : null, days: payDays });
    return rhythm ? [{ ...recurring, rhythm, startsOn: dateKeyOf(startsOn) }] : [];
  });
}

/** Every confirmed or changed recurring amount, by item, for estimating variable bills. */
async function getRecurringHistory(userId: string): Promise<ConfirmedAmount[]> {
  const rows = await db.recurringOccurrence.findMany({
    where: { userId, amountCents: { not: null } },
    select: { month: true, amountCents: true, recurringPayment: { select: { itemId: true } } },
  });
  return rows.map((row) => ({ itemId: row.recurringPayment.itemId, month: row.month, amountCents: row.amountCents! }));
}

function getOccurrenceOverrides(userId: string, from: MonthKey, to: MonthKey): Promise<OccurrenceOverride[]> {
  return db.recurringOccurrence.findMany({
    where: { userId, month: { gte: monthRange(from).start, lt: monthRange(to).end } },
    select: { recurringPaymentId: true, month: true, amountCents: true, paidAt: true, chargedOn: true },
  });
}

/** Cards, including archived ones, since their statements may still be due. */
export function getCards(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, kind: "CARD" },
    select: { ...paymentMethodSelect, closingDay: true, paymentDays: true, archivedAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Income groups, including archived ones, with the categories each deducts. */
export async function getIncomeGroups(userId: string, { activeOnly = false } = {}): Promise<LedgerIncomeGroup[]> {
  const groups = await db.incomeGroup.findMany({
    where: { userId, ...(activeOnly ? { archivedAt: null } : {}) },
    select: { id: true, name: true, deductions: { select: { categoryId: true } } },
    orderBy: { createdAt: "asc" },
  });
  return groups.map(({ deductions, ...group }) => ({ ...group, deductCategoryIds: deductions.map((deduction) => deduction.categoryId) }));
}

export function getSavingsFunds(userId: string) {
  return db.savingsFund.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, kind: true, name: true, targetCents: true, coverMonths: true, currency: true },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Purchases dated before `to` ends that can count from `from` on: single payments from `singlesFrom`, and
 * installment purchases from `installmentsFrom`, since their installments keep landing for up to 48 months.
 */
function getPurchases(userId: string, { singlesFrom, installmentsFrom, to }: { singlesFrom: MonthKey; installmentsFrom: MonthKey; to: MonthKey }) {
  return db.purchase.findMany({
    where: {
      userId,
      date: { lt: monthRange(to).end },
      OR: [
        { date: { gte: monthRange(singlesFrom).start } },
        { installmentCount: { gt: 1 }, date: { gte: monthRange(installmentsFrom).start } },
      ],
    },
    select: purchaseSelect,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Loads everything needed to summarize each month from `from` through `to` (spending, income, recurring
 * payments, card statements, savings), with lookbacks for installments and statements. `statementsFrom`
 * extends complete statements further back, for carrying unpaid ones forward; `purchasesFrom` loads single
 * purchases and incomes from an earlier month too, for figures that look back further (typical daily spending, the
 * pace of work). Month summaries only count their own month's incomes.
 */
export async function loadLedgerRange(userId: string, from: MonthKey, to: MonthKey, { statementsFrom: statementsStart = from, purchasesFrom }: {
  statementsFrom?: MonthKey;
  purchasesFrom?: MonthKey;
} = {}) {
  const statementsFrom = addMonths(statementsStart < from ? statementsStart : from, -STATEMENT_LOOKBACK_MONTHS);
  const [categories, definitions, cards, purchases, incomes, overrides, recurringHistory, paidStatements, savingsMovements, incomeGroups] = await Promise.all([
    db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } }),
    getRecurringDefinitions(userId),
    getCards(userId),
    // A single purchase lands on the statement closing in its month or the next, so the statement window covers it.
    getPurchases(userId, {
      singlesFrom: purchasesFrom && purchasesFrom < statementsFrom ? purchasesFrom : statementsFrom,
      installmentsFrom: earliestContributingMonth(statementsFrom),
      to,
    }),
    db.income.findMany({
      where: { userId, date: { gte: monthRange(purchasesFrom && purchasesFrom < from ? purchasesFrom : from).start, lt: monthRange(to).end } },
      select: {
        id: true, date: true, amountCents: true, note: true, currency: true, recurringIncomeId: true, expectedOn: true,
        source: { select: { id: true, name: true, groupId: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getOccurrenceOverrides(userId, statementsFrom, addMonths(to, 1)),
    getRecurringHistory(userId),
    db.statementPayment.findMany({ where: { userId }, select: { paymentMethodId: true, statementMonth: true } }),
    db.savingsMovement.findMany({ where: { userId }, select: { id: true, fundId: true, date: true, amountCents: true, note: true, fund: { select: { currency: true } } }, orderBy: { date: "desc" } }),
    getIncomeGroups(userId),
  ]);

  const statements = statementsForCards({
    cards,
    purchases: purchases.filter((purchase) => purchase.paymentMethod.kind === "CARD"),
    definitions,
    overrides,
    recurringHistory,
    recurringFrom: statementsFrom,
    recurringTo: addMonths(to, 1),
    paidStatements,
  });

  const data: LedgerData = {
    categories, purchases, incomes, incomeGroups, definitions, overrides, recurringHistory, statements,
    savingsMovements: savingsMovements.map(({ fund, ...movement }) => ({ ...movement, currency: fund.currency })),
  };
  return { data, cards };
}

/** Cash bills and card statements marked paid after `since`, with their amounts. */
/** A bill or statement marked paid, with what it was paid from: a card statement's currency, or a cash bill's wallet. */
type WalletBill = PaidBill & { currency?: string; paymentMethodId?: string };

async function getBillsPaidSince(userId: string, since: Date): Promise<WalletBill[]> {
  const [statementPayments, occurrencePayments] = await Promise.all([
    db.statementPayment.findMany({ where: { userId, paidAt: { gt: since } }, select: { paymentMethodId: true, statementMonth: true, paidAt: true } }),
    db.recurringOccurrence.findMany({ where: { userId, paidAt: { gt: since } }, select: { recurringPaymentId: true, month: true, paidAt: true } }),
  ]);
  const months = [...statementPayments.map((paid) => monthKeyOf(paid.statementMonth)), ...occurrencePayments.map((paid) => monthKeyOf(paid.month))].sort();
  if (months.length === 0) return [];

  // Amounts are derived, so the months holding them are loaded like any other view.
  const { data } = await loadLedgerRange(userId, months[0], months[months.length - 1]);
  const statements = statementPayments.map((paid) => {
    const statement = data.statements.find((item) => item.paymentMethodId === paid.paymentMethodId && item.month === monthKeyOf(paid.statementMonth));
    return { paidAt: paid.paidAt, amountCents: statement?.totalCents ?? 0, currency: statement?.currency };
  });
  const bills = occurrencePayments.map((paid) => {
    const occurrence = occurrencesForMonth(data.definitions, data.overrides, monthKeyOf(paid.month), data.recurringHistory)
      .find((item) => item.recurring.id === paid.recurringPaymentId && item.recurring.paymentMethod.kind === "CASH");
    return { paidAt: paid.paidAt!, amountCents: occurrence?.amountCents ?? 0, paymentMethodId: occurrence?.recurring.paymentMethod.id };
  });
  return [...statements, ...bills];
}

/** Money changed between currencies during a month, newest first. */
export function getExchanges(userId: string, month: MonthKey) {
  return db.currencyExchange.findMany({
    where: { userId, date: { gte: monthRange(month).start, lt: monthRange(month).end } },
    select: { id: true, date: true, fromCurrency: true, fromCents: true, toCurrency: true, toCents: true, note: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

/** A cash wallet: money on hand in one currency, as last counted (null until first counted). */
export type CashWallet = { id: string; name: string; color: string; currency: string; count: CashCount | null };

/** Active cash wallets, the first one created first. */
export async function getCashWallets(userId: string): Promise<CashWallet[]> {
  const wallets = await db.paymentMethod.findMany({
    where: { userId, kind: "CASH", archivedAt: null },
    select: { id: true, name: true, color: true, currency: true, cashCountCents: true, cashCountedAt: true },
    orderBy: { createdAt: "asc" },
  });
  return wallets.map(({ cashCountCents, cashCountedAt, ...wallet }) => ({
    ...wallet,
    count: cashCountCents != null && cashCountedAt ? { cents: cashCountCents, setAt: cashCountedAt, day: dateKeyInAppZone(cashCountedAt) } : null,
  }));
}

/**
 * Money on hand in each cash wallet now (null for one not counted yet): its count, moved by the records in its
 * currency since then. Callers that already loaded the wallets pass them, saving a read before the rest.
 */
export async function loadCashOnHand(userId: string, knownWallets?: CashWallet[]): Promise<{ wallet: CashWallet; cents: number | null; parts: CashOnHandParts | null }[]> {
  const wallets = knownWallets ?? await getCashWallets(userId);
  const counts = wallets.flatMap((wallet) => (wallet.count ? [wallet.count] : []));
  if (counts.length === 0) return wallets.map((wallet) => ({ wallet, cents: null, parts: null }));

  const today = todayKey();
  const firstDay = counts.map((count) => count.day).sort()[0];
  const firstSetAt = new Date(Math.min(...counts.map((count) => count.setAt.getTime())));
  const where = { userId, date: { gte: dateFromKey(firstDay), lte: dateFromKey(today) } };
  const select = { date: true, createdAt: true, amountCents: true } as const;
  const [incomes, cashPurchases, savingsMovements, exchanges, paidBills] = await Promise.all([
    db.income.findMany({ where, select: { ...select, currency: true } }),
    db.purchase.findMany({ where: { ...where, paymentMethod: { kind: "CASH" } }, select: { ...select, paymentMethodId: true } }),
    db.savingsMovement.findMany({ where, select: { ...select, fund: { select: { currency: true } } } }),
    db.currencyExchange.findMany({ where, select: { date: true, createdAt: true, fromCurrency: true, fromCents: true, toCurrency: true, toCents: true } }),
    getBillsPaidSince(userId, firstSetAt),
  ]);

  return wallets.map((wallet) => {
    if (!wallet.count) return { wallet, cents: null, parts: null };
    const { currency } = wallet;
    const transfers = exchanges.flatMap((exchange) => [
      ...(exchange.toCurrency === currency ? [{ date: exchange.date, createdAt: exchange.createdAt, amountCents: exchange.toCents }] : []),
      ...(exchange.fromCurrency === currency ? [{ date: exchange.date, createdAt: exchange.createdAt, amountCents: -exchange.fromCents }] : []),
    ]);
    const parts = cashOnHandParts({
      count: wallet.count,
      today,
      incomes: incomes.filter((income) => income.currency === currency),
      cashPurchases: cashPurchases.filter((purchase) => purchase.paymentMethodId === wallet.id),
      savingsMovements: savingsMovements.filter((movement) => movement.fund.currency === currency),
      paidBills: paidBills.filter((bill) => (bill.paymentMethodId ? bill.paymentMethodId === wallet.id : bill.currency === currency)),
      transfers,
    });
    return { wallet, cents: parts.cents, parts };
  });
}
