import "server-only";

import { db } from "@/db/client";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, includeInAverage: true } as const;

/** All categories, including archived ones, so past spending is still totalled under them. */
export function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Items offered when recording a purchase or recurring payment. */
export function getActiveItems(userId: string) {
  return db.expenseItem.findMany({
    where: { userId, archivedAt: null, category: { archivedAt: null } },
    select: { id: true, name: true, categoryId: true },
    orderBy: { name: "asc" },
  });
}

/** Every item with its category and how often it is used, for managing items. */
export function getItemsWithUsage(userId: string) {
  return db.expenseItem.findMany({
    where: { userId },
    select: { id: true, name: true, categoryId: true, archivedAt: true, _count: { select: { purchases: true, recurringPayments: true } } },
    orderBy: { name: "asc" },
  });
}

/** Categories that can be chosen for new entries. */
export function getActiveCategories(userId: string) {
  return db.category.findMany({ where: { userId, archivedAt: null }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Cash first, then cards in the order they were added. */
export function getActivePaymentMethods(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, kind: true, name: true, color: true, closingDay: true, paymentDays: true },
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

export function getOwnedPurchase(userId: string, id: string) {
  return db.purchase.findFirst({
    where: { id, userId },
    select: {
      id: true, date: true, amountCents: true, note: true, installmentCount: true, paymentMethodId: true,
      item: { select: { name: true } },
      paymentMethod: { select: { id: true, kind: true, name: true, color: true } },
    },
  });
}

export function getOwnedIncome(userId: string, id: string) {
  return db.income.findFirst({
    where: { id, userId },
    select: { id: true, date: true, amountCents: true, note: true, source: { select: { id: true, name: true } } },
  });
}

/** Every category with whether it is archived, for managing categories. */
export function getCategoriesForManagement(userId: string) {
  return db.category.findMany({
    where: { userId },
    select: { ...categorySelect, archivedAt: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
