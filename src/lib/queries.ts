import "server-only";

import { db } from "@/db/client";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, includeInAverage: true } as const;

/** All categories, including archived ones, so past spending is still totalled under them. */
export function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Categories that can be chosen for new entries. */
export function getActiveCategories(userId: string) {
  return db.category.findMany({ where: { userId, archivedAt: null }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Cash first, then cards in the order they were added. */
export function getActivePaymentMethods(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, kind: true, name: true, color: true, closingDay: true, dueDay: true },
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
