import "server-only";

import { db } from "@/db/client";
import { incomeRhythmOf } from "@/lib/income-rhythm";
import { dateKeyOf, monthKeyOf } from "@/lib/months";
import { parseSummaryCards } from "@/lib/stats";
import { usualPurchases } from "@/lib/usual-purchase";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, kind: true } as const;

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

/** Recent purchases scanned for each item's usual payment method and amount. */
const USUAL_PURCHASE_SCAN = 500;

/** Each item's usual payment method and amount, from the latest purchases. */
export async function getUsualPurchases(userId: string) {
  const purchases = await db.purchase.findMany({
    where: { userId },
    select: { itemId: true, paymentMethodId: true, amountCents: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: USUAL_PURCHASE_SCAN,
  });
  return usualPurchases(purchases);
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
    select: { id: true, name: true, groupId: true },
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

/**
 * Settings that shape month figures: the balance goal (centavos), the first month history counts from, the income
 * rhythm (with its stored parts for editing), and the customized summary cards.
 */
export async function getUserSettings(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { balanceGoalCents: true, historyStartMonth: true, incomeRhythm: true, incomeRhythmAnchor: true, incomePayDays: true, summaryCards: true },
  });
  const rhythmParts = {
    kind: user?.incomeRhythm ?? "DAILY",
    anchor: user?.incomeRhythmAnchor ? dateKeyOf(user.incomeRhythmAnchor) : null,
    days: user?.incomePayDays ?? [],
  };
  return {
    balanceGoalCents: user?.balanceGoalCents ?? null,
    historyStartMonth: user?.historyStartMonth ? monthKeyOf(user.historyStartMonth) : null,
    incomeRhythm: incomeRhythmOf(rhythmParts),
    rhythmParts,
    summaryCards: parseSummaryCards(user?.summaryCards),
  };
}

/** Every income group with the categories it deducts and whether it is archived, for managing groups. */
export async function getIncomeGroupsForManagement(userId: string) {
  const groups = await db.incomeGroup.findMany({
    where: { userId },
    select: { id: true, name: true, archivedAt: true, deductions: { select: { categoryId: true } } },
    orderBy: { createdAt: "asc" },
  });
  return groups.map(({ deductions, ...group }) => ({ ...group, deductCategoryIds: deductions.map((deduction) => deduction.categoryId) }));
}
