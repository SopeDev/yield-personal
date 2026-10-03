import "server-only";

import { db } from "@/db/client";
import { earliestContributingMonth } from "@/lib/installments";
import type { LedgerIncome, LedgerPurchase } from "@/lib/ledger";
import { monthRange, type MonthKey } from "@/lib/months";

const categorySelect = { id: true, key: true, name: true, sortOrder: true } as const;
const paymentMethodSelect = { id: true, kind: true, name: true, color: true } as const;

export function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Cash first, then cards in the order they were added. */
export function getActivePaymentMethods(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, archivedAt: null },
    select: { ...paymentMethodSelect, closingDay: true, dueDay: true },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

export function getActiveIncomeSources(userId: string) {
  return db.incomeSource.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, isRideshare: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Purchases that may count toward the month, including earlier installment purchases still being paid. */
export function getPurchasesReachingMonth(userId: string, month: MonthKey): Promise<LedgerPurchase[]> {
  return db.purchase.findMany({
    where: {
      userId,
      date: { gte: monthRange(earliestContributingMonth(month)).start, lt: monthRange(month).end },
    },
    select: {
      id: true,
      date: true,
      amountCents: true,
      description: true,
      installmentCount: true,
      category: { select: categorySelect },
      paymentMethod: { select: paymentMethodSelect },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export function getMonthIncomes(userId: string, month: MonthKey): Promise<LedgerIncome[]> {
  const { start, end } = monthRange(month);
  return db.income.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { id: true, date: true, amountCents: true, note: true, source: { select: { id: true, name: true, isRideshare: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}
