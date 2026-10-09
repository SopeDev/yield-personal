import "server-only";

import { db } from "@/db/client";
import { statementsForCards } from "@/lib/card-statements";
import { cashOnHandCents, type CashCount, type PaidBill } from "@/lib/cash-on-hand";
import { earliestContributingMonth } from "@/lib/installments";
import type { LedgerIncomeGroup } from "@/lib/ledger";
import type { LedgerData } from "@/lib/month-summary";
import { addMonths, dateFromKey, monthKeyOf, monthRange, type MonthKey } from "@/lib/months";
import { occurrencesForMonth, type ConfirmedAmount, type OccurrenceOverride, type RecurringDefinition } from "@/lib/recurring";
import { dateKeyInAppZone, monthKeyInAppZone, todayKey } from "@/lib/today";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, kind: true } as const;
const paymentMethodSelect = { id: true, kind: true, name: true, color: true } as const;
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
    select: { id: true, kind: true, name: true, targetCents: true, coverMonths: true },
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
 * purchases from an earlier month too, for figures that look back further (typical daily spending).
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
      where: { userId, date: { gte: monthRange(from).start, lt: monthRange(to).end } },
      select: { id: true, date: true, amountCents: true, note: true, source: { select: { id: true, name: true, groupId: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getOccurrenceOverrides(userId, statementsFrom, addMonths(to, 1)),
    getRecurringHistory(userId),
    db.statementPayment.findMany({ where: { userId }, select: { paymentMethodId: true, statementMonth: true } }),
    db.savingsMovement.findMany({ where: { userId }, select: { id: true, fundId: true, date: true, amountCents: true, note: true }, orderBy: { date: "desc" } }),
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

  const data: LedgerData = { categories, purchases, incomes, incomeGroups, definitions, overrides, recurringHistory, statements, savingsMovements };
  return { data, cards };
}

/** Cash bills and card statements marked paid after `since`, with their amounts. */
async function getBillsPaidSince(userId: string, since: Date): Promise<PaidBill[]> {
  const [statementPayments, occurrencePayments] = await Promise.all([
    db.statementPayment.findMany({ where: { userId, paidAt: { gt: since } }, select: { paymentMethodId: true, statementMonth: true, paidAt: true } }),
    db.recurringOccurrence.findMany({ where: { userId, paidAt: { gt: since } }, select: { recurringPaymentId: true, month: true, paidAt: true } }),
  ]);
  const months = [...statementPayments.map((paid) => monthKeyOf(paid.statementMonth)), ...occurrencePayments.map((paid) => monthKeyOf(paid.month))].sort();
  if (months.length === 0) return [];

  // Amounts are derived, so the months holding them are loaded like any other view.
  const { data } = await loadLedgerRange(userId, months[0], months[months.length - 1]);
  const statements = statementPayments.map((paid) => ({
    paidAt: paid.paidAt,
    amountCents: data.statements.find((statement) => statement.paymentMethodId === paid.paymentMethodId && statement.month === monthKeyOf(paid.statementMonth))?.totalCents ?? 0,
  }));
  const bills = occurrencePayments.map((paid) => {
    const occurrence = occurrencesForMonth(data.definitions, data.overrides, monthKeyOf(paid.month), data.recurringHistory)
      .find((item) => item.recurring.id === paid.recurringPaymentId && item.recurring.paymentMethod.kind === "CASH");
    return { paidAt: paid.paidAt!, amountCents: occurrence?.amountCents ?? 0 };
  });
  return [...statements, ...bills];
}

/** Money on hand now, from the amount last counted in Settings and the records since; null until it is first set. */
async function getCashCount(userId: string): Promise<CashCount | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { cashOnHandCents: true, cashOnHandSetAt: true } });
  if (user?.cashOnHandCents == null || !user.cashOnHandSetAt) return null;
  return { cents: user.cashOnHandCents, setAt: user.cashOnHandSetAt, day: dateKeyInAppZone(user.cashOnHandSetAt) };
}

export async function loadCashOnHand(userId: string, knownCount?: CashCount | null): Promise<number | null> {
  // Callers that loaded settings already have the count (`getUserSettings`), saving a read before the rest.
  const count = knownCount === undefined ? await getCashCount(userId) : knownCount;
  if (!count) return null;

  const today = todayKey();
  const where = { userId, date: { gte: dateFromKey(count.day), lte: dateFromKey(today) } };
  const select = { date: true, createdAt: true, amountCents: true } as const;
  const [incomes, cashPurchases, savingsMovements, paidBills] = await Promise.all([
    db.income.findMany({ where, select }),
    db.purchase.findMany({ where: { ...where, paymentMethod: { kind: "CASH" } }, select }),
    db.savingsMovement.findMany({ where, select }),
    getBillsPaidSince(userId, count.setAt),
  ]);
  return cashOnHandCents({ count, today, incomes, cashPurchases, savingsMovements, paidBills });
}
