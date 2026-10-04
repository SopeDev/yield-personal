import { recurringChargeId } from "./cash-flow";
import { addMonths, monthKeyOf, type MonthKey } from "./months";
import { occurrencesForMonth, type OccurrenceOverride, type RecurringDefinition, type RecurringOccurrence } from "./recurring";
import { buildStatements, type Statement } from "./statements";

type Card = { id: string; closingDay: number | null; dueDay: number | null };
type CardPurchase = { id: string; description: string; date: Date; amountCents: number; installmentCount: number; paymentMethod: { id: string } };

/**
 * Statements for every card from card purchases and from recurring card charges in `recurringFrom`..`recurringTo`.
 * Statements outside the windows the inputs cover may be incomplete; callers use only the months they loaded for.
 */
export function statementsForCards({ cards, purchases, definitions, overrides, recurringFrom, recurringTo, paidStatements }: {
  cards: Card[];
  purchases: CardPurchase[];
  definitions: RecurringDefinition[];
  overrides: OccurrenceOverride[];
  recurringFrom: MonthKey;
  recurringTo: MonthKey;
  paidStatements: { paymentMethodId: string; statementMonth: Date }[];
}): Statement[] {
  const cardDefinitions = definitions.filter((definition) => definition.paymentMethod.kind === "CARD");
  const occurrences: RecurringOccurrence[] = [];
  for (let month = recurringFrom; month <= recurringTo; month = addMonths(month, 1)) {
    occurrences.push(...occurrencesForMonth(cardDefinitions, overrides, month));
  }

  return cards.flatMap((card) => {
    if (card.closingDay == null || card.dueDay == null) return [];
    return buildStatements(
      { id: card.id, closingDay: card.closingDay, dueDay: card.dueDay },
      purchases.filter((purchase) => purchase.paymentMethod.id === card.id),
      occurrences
        .filter((occurrence) => occurrence.recurring.paymentMethod.id === card.id)
        .map((occurrence) => ({ id: recurringChargeId(occurrence), description: occurrence.recurring.name, date: occurrence.date, amountCents: occurrence.amountCents })),
      new Set(paidStatements.filter((paid) => paid.paymentMethodId === card.id).map((paid) => monthKeyOf(paid.statementMonth))),
    );
  });
}
