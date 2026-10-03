import "server-only";

import { db } from "@/db/client";
import { recurringChargeId } from "@/lib/cash-flow";
import { addMonths, monthKeyOf, monthRange, type MonthKey } from "@/lib/months";
import { occurrencesForMonth, type OccurrenceOverride, type RecurringDefinition } from "@/lib/recurring";
import { buildStatements, type Statement } from "@/lib/statements";

const categorySelect = { id: true, key: true, name: true, sortOrder: true } as const;
const paymentMethodSelect = { id: true, kind: true, name: true, color: true } as const;

/** All recurring payments, including stopped ones, so past months still show what was due. */
export function getRecurringDefinitions(userId: string): Promise<RecurringDefinition[]> {
  return db.recurringPayment.findMany({
    where: { userId },
    select: {
      id: true, name: true, amountCents: true, dayOfMonth: true, startMonth: true, endMonth: true,
      category: { select: categorySelect },
      paymentMethod: { select: paymentMethodSelect },
    },
    orderBy: [{ dayOfMonth: "asc" }, { name: "asc" }],
  });
}

export function getOccurrenceOverrides(userId: string, from: MonthKey, to: MonthKey): Promise<OccurrenceOverride[]> {
  return db.recurringOccurrence.findMany({
    where: { userId, month: { gte: monthRange(from).start, lt: monthRange(to).end } },
    select: { recurringPaymentId: true, month: true, amountCents: true, paidAt: true },
  });
}

/** Cards, including archived ones, since their statements may still be due. */
export function getCards(userId: string) {
  return db.paymentMethod.findMany({
    where: { userId, kind: "CARD" },
    select: { ...paymentMethodSelect, closingDay: true, dueDay: true, archivedAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Builds card statements from card purchases made since `purchasesFrom` and recurring card charges in
 * `recurringFrom`..`recurringTo`. Statements outside those windows may be incomplete, so callers only use
 * statements the windows fully cover.
 */
export async function getStatements(userId: string, { purchasesFrom, recurringFrom, recurringTo, definitions }: {
  purchasesFrom: MonthKey;
  recurringFrom: MonthKey;
  recurringTo: MonthKey;
  definitions: RecurringDefinition[];
}) {
  const [cards, purchases, overrides, payments] = await Promise.all([
    getCards(userId),
    db.purchase.findMany({
      where: { userId, paymentMethod: { kind: "CARD" }, date: { gte: monthRange(purchasesFrom).start } },
      select: { id: true, description: true, date: true, amountCents: true, installmentCount: true, paymentMethodId: true },
    }),
    getOccurrenceOverrides(userId, recurringFrom, recurringTo),
    db.statementPayment.findMany({ where: { userId }, select: { paymentMethodId: true, statementMonth: true } }),
  ]);

  const recurringMonths: MonthKey[] = [];
  for (let month = recurringFrom; month <= recurringTo; month = addMonths(month, 1)) recurringMonths.push(month);
  const cardOccurrences = recurringMonths.flatMap((month) =>
    occurrencesForMonth(definitions.filter((definition) => definition.paymentMethod.kind === "CARD"), overrides, month),
  );

  const statements: Statement[] = cards.flatMap((card) => {
    if (card.closingDay == null || card.dueDay == null) return [];
    return buildStatements(
      { id: card.id, closingDay: card.closingDay, dueDay: card.dueDay },
      purchases.filter((purchase) => purchase.paymentMethodId === card.id),
      cardOccurrences
        .filter((occurrence) => occurrence.recurring.paymentMethod.id === card.id)
        .map((occurrence) => ({ id: recurringChargeId(occurrence), description: occurrence.recurring.name, date: occurrence.date, amountCents: occurrence.amountCents })),
      new Set(payments.filter((payment) => payment.paymentMethodId === card.id).map((payment) => monthKeyOf(payment.statementMonth))),
    );
  });

  return { cards, statements };
}
