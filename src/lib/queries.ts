import "server-only";

import { cache } from "react";
import { db } from "@/db/client";
import { incomeRhythmOf } from "@/lib/income-rhythm";
import { byName } from "@/lib/items";
import { DEFAULT_CURRENCY, isCurrency, type Currency } from "@/lib/money";
import { dateKeyOf, monthKeyOf } from "@/lib/months";
import { parseSummaryCards } from "@/lib/stats";
import { checklistDone, type SetupChecklist } from "@/lib/onboarding";
import { usualPurchases } from "@/lib/usual-purchase";

const categorySelect = { id: true, key: true, name: true, sortOrder: true, kind: true } as const;

/** All categories, including archived ones, so past spending is still totalled under them. */
export function getCategories(userId: string) {
  return db.category.findMany({ where: { userId }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Items offered when recording a purchase or recurring payment. */
export async function getActiveItems(userId: string) {
  const items = await db.expenseItem.findMany({
    where: { userId, archivedAt: null, category: { archivedAt: null } },
    select: { id: true, name: true, categoryId: true },
  });
  return items.sort(byName);
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
export async function getItemsWithUsage(userId: string) {
  const items = await db.expenseItem.findMany({
    where: { userId },
    select: { id: true, name: true, categoryId: true, archivedAt: true, _count: { select: { purchases: true, recurringPayments: true } } },
  });
  return items.sort(byName);
}

/** Every category, item, and income source by name, archived ones included, for naming configurable stats. */
export async function getStatNames(userId: string) {
  const [categories, items, sources] = await Promise.all([
    db.category.findMany({ where: { userId }, select: { id: true, key: true, name: true } }),
    db.expenseItem.findMany({ where: { userId }, select: { id: true, name: true } }),
    db.incomeSource.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  return { categories, items, sources };
}

/** Categories that can be chosen for new entries. */
export function getActiveCategories(userId: string) {
  return db.category.findMany({ where: { userId, archivedAt: null }, select: categorySelect, orderBy: { sortOrder: "asc" } });
}

/** Cash wallets first, then cards, each in the order they were added. */
export function getActivePaymentMethods(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, kind: true, name: true, color: true, currency: true, closingDay: true, paymentDays: true },
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
      id: true, date: true, amountCents: true, note: true, installmentCount: true, paymentMethodId: true, planned: true,
      item: { select: { name: true } },
      paymentMethod: { select: { id: true, kind: true, name: true, color: true, currency: true } },
    },
  });
}

/** The currencies of the user's cash wallets, the main currency first: what income and exchanges can be in. */
export function walletCurrencies(mainCurrency: string, methods: { kind: string; currency: string }[]) {
  const others = methods.filter((method) => method.kind === "CASH" && method.currency !== mainCurrency).map((method) => method.currency);
  return [mainCurrency, ...[...new Set(others)].sort()];
}

export function getOwnedIncome(userId: string, id: string) {
  return db.income.findFirst({
    where: { id, userId },
    select: { id: true, date: true, amountCents: true, note: true, currency: true, source: { select: { id: true, name: true } } },
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

function currencyOf(value: string | undefined): Currency {
  return value && isCurrency(value) ? value : DEFAULT_CURRENCY;
}

/** The user's main currency, read once per request however many components ask (the layout and some pages). */
/** What every app screen needs about the user: the main currency, and whether the account has been set up. */
export const getShellUser = cache(async (userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { currency: true, onboardedAt: true, setupDismissedAt: true, email: true } });
  return { currency: currencyOf(user?.currency), onboarded: user?.onboardedAt != null, setupDismissed: user?.setupDismissedAt != null, email: user?.email ?? null };
});

export const getMainCurrency = cache(async (userId: string) => (await getShellUser(userId)).currency);

/**
 * The setup checklist shown on the month view after the wizard, with each step done or not, or null once it's
 * dismissed or every step is done.
 */
export async function getSetupChecklist(userId: string): Promise<SetupChecklist | null> {
  const { onboarded, setupDismissed } = await getShellUser(userId);
  if (!onboarded || setupDismissed) return null;
  const [counted, bills, cards, expense] = await Promise.all([
    db.paymentMethod.findFirst({ where: { userId, kind: "CASH", cashCountedAt: { not: null } }, select: { id: true } }),
    db.recurringPayment.findFirst({ where: { userId }, select: { id: true } }),
    db.paymentMethod.findFirst({ where: { userId, kind: "CARD" }, select: { id: true } }),
    db.purchase.findFirst({ where: { userId }, select: { id: true } }),
  ]);
  const checklist = { cash: counted !== null, bills: bills !== null, cards: cards !== null, expense: expense !== null };
  return checklistDone(checklist) ? null : checklist;
}

/**
 * Settings that shape month figures: the balance goal (cents), the first month history counts from (and `historyFrom`,
 * the day it does for a new account), the income rhythm (with its stored parts for editing), the customized summary
 * cards, and the setup wizard's estimates, which stand in for averages while there's little history.
 */
export async function getUserSettings(userId: string) {
  const [user, estimated] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        balanceGoalCents: true, historyStartMonth: true, incomeRhythm: true, incomeRhythmAnchor: true, incomePayDays: true, summaryCards: true,
        currency: true, trackingFrom: true, incomeEstimateCents: true,
      },
    }),
    db.category.findMany({ where: { userId, monthlyEstimateEnc: { not: null } }, select: { id: true, monthlyEstimateCents: true } }),
  ]);
  const rhythmParts = {
    kind: user?.incomeRhythm ?? "DAILY",
    anchor: user?.incomeRhythmAnchor ? dateKeyOf(user.incomeRhythmAnchor) : null,
    days: user?.incomePayDays ?? [],
  };
  return {
    balanceGoalCents: user?.balanceGoalCents ?? null,
    historyStartMonth: user?.historyStartMonth ? monthKeyOf(user.historyStartMonth) : null,
    historyFrom: user?.trackingFrom ? dateKeyOf(user.trackingFrom) : null,
    estimates: {
      spending: estimated.flatMap((category) => (category.monthlyEstimateCents ? [{ categoryId: category.id, monthlyCents: category.monthlyEstimateCents }] : [])),
      incomeMonthlyCents: user?.incomeEstimateCents ?? 0,
    },
    incomeRhythm: incomeRhythmOf(rhythmParts),
    rhythmParts,
    summaryCards: parseSummaryCards(user?.summaryCards),
    currency: currencyOf(user?.currency),
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
