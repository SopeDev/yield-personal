import { CAR_CATEGORY_KEY } from "./categories";
import { consumptionInMonth } from "./installments";
import type { MonthKey } from "./months";

export type LedgerCategory = { id: string; key: string | null; name: string | null; sortOrder: number };
export type LedgerPaymentMethod = { id: string; kind: "CASH" | "CARD"; name: string; color: string };
export type LedgerPurchase = {
  id: string;
  date: Date;
  amountCents: number;
  description: string;
  installmentCount: number;
  category: LedgerCategory;
  paymentMethod: LedgerPaymentMethod;
};
export type LedgerIncomeSource = { id: string; name: string; isRideshare: boolean };
export type LedgerIncome = { id: string; date: Date; amountCents: number; note: string | null; source: LedgerIncomeSource };

export type MonthSpendingEntry = {
  purchase: LedgerPurchase;
  /** The amount counted this month: the full amount, or one installment. */
  amountCents: number;
  installmentNumber: number;
};

/** Spending that counts toward a month's consumption, newest first. */
export function monthSpendingEntries(purchases: LedgerPurchase[], month: MonthKey): MonthSpendingEntry[] {
  return purchases
    .flatMap((purchase) => {
      const portion = consumptionInMonth(purchase, month);
      return portion ? [{ purchase, ...portion }] : [];
    })
    .sort((a, b) => b.purchase.date.getTime() - a.purchase.date.getTime());
}

export function summarizeSpending(entries: MonthSpendingEntry[], categories: LedgerCategory[]) {
  const totals = new Map(categories.map((category) => [category.id, 0]));
  for (const entry of entries) {
    totals.set(entry.purchase.category.id, (totals.get(entry.purchase.category.id) ?? 0) + entry.amountCents);
  }

  const byCategory = [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({ category, totalCents: totals.get(category.id) ?? 0 }));
  const totalCents = byCategory.reduce((sum, item) => sum + item.totalCents, 0);
  const carCents = byCategory.find((item) => item.category.key === CAR_CATEGORY_KEY)?.totalCents ?? 0;

  return { byCategory, totalCents, carCents };
}

export function summarizeIncome(incomes: LedgerIncome[], carSpendingCents: number) {
  const bySourceId = new Map<string, { source: LedgerIncomeSource; totalCents: number }>();
  for (const income of incomes) {
    const current = bySourceId.get(income.source.id) ?? { source: income.source, totalCents: 0 };
    current.totalCents += income.amountCents;
    bySourceId.set(income.source.id, current);
  }

  const bySource = [...bySourceId.values()].sort((a, b) => b.totalCents - a.totalCents);
  const totalCents = bySource.reduce((sum, item) => sum + item.totalCents, 0);
  const rideshareGrossCents = bySource
    .filter((item) => item.source.isRideshare)
    .reduce((sum, item) => sum + item.totalCents, 0);

  return {
    bySource,
    totalCents,
    rideshareGrossCents,
    netRideshareCents: rideshareGrossCents - carSpendingCents,
  };
}
