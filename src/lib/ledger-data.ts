import "server-only";

import { db } from "@/db/client";
import { statementsForCards } from "@/lib/card-statements";
import { earliestContributingMonth } from "@/lib/installments";
import type { LedgerData } from "@/lib/month-summary";
import { addMonths, monthRange, type MonthKey } from "@/lib/months";
import type { ConfirmedAmount, OccurrenceOverride, RecurringDefinition } from "@/lib/recurring";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, includeInAverage: true } as const;
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
export function getRecurringDefinitions(userId: string): Promise<RecurringDefinition[]> {
  return db.recurringPayment.findMany({
    where: { userId },
    select: {
      id: true, amountCents: true, isVariable: true, intervalMonths: true, dayOfMonth: true, startMonth: true, endMonth: true,
      item: { select: itemSelect },
      paymentMethod: { select: paymentMethodSelect },
    },
    orderBy: [{ dayOfMonth: "asc" }, { item: { name: "asc" } }],
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
    select: { recurringPaymentId: true, month: true, amountCents: true, paidAt: true },
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

export function getSavingsFunds(userId: string) {
  return db.savingsFund.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, kind: true, name: true, targetCents: true, coverMonths: true },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Loads everything needed to summarize each month from `from` through `to` (spending, income, recurring
 * payments, card statements, savings), with lookbacks for installments and statements. `statementsFrom`
 * extends complete statements further back, for carrying unpaid ones forward.
 */
export async function loadLedgerRange(userId: string, from: MonthKey, to: MonthKey, { statementsFrom: statementsStart = from }: { statementsFrom?: MonthKey } = {}) {
  const statementsFrom = addMonths(statementsStart < from ? statementsStart : from, -STATEMENT_LOOKBACK_MONTHS);
  const [categories, definitions, cards, purchases, incomes, overrides, recurringHistory, paidStatements, savingsMovements] = await Promise.all([
    db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } }),
    getRecurringDefinitions(userId),
    getCards(userId),
    db.purchase.findMany({
      where: { userId, date: { gte: monthRange(earliestContributingMonth(statementsFrom)).start, lt: monthRange(to).end } },
      select: purchaseSelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.income.findMany({
      where: { userId, date: { gte: monthRange(from).start, lt: monthRange(to).end } },
      select: { id: true, date: true, amountCents: true, note: true, source: { select: { id: true, name: true, isRideshare: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getOccurrenceOverrides(userId, statementsFrom, addMonths(to, 1)),
    getRecurringHistory(userId),
    db.statementPayment.findMany({ where: { userId }, select: { paymentMethodId: true, statementMonth: true } }),
    db.savingsMovement.findMany({ where: { userId }, select: { id: true, fundId: true, date: true, amountCents: true, note: true }, orderBy: { date: "desc" } }),
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

  const data: LedgerData = { categories, purchases, incomes, definitions, overrides, recurringHistory, statements, savingsMovements };
  return { data, cards };
}
