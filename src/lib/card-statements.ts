import { recurringChargeId } from "./cash-flow";
import { addMonths, monthKeyOf, type MonthKey } from "./months";
import { occurrencesForMonth, type ConfirmedAmount, type OccurrenceOverride, type RecurringDefinition, type RecurringOccurrence } from "./recurring";
import { buildStatements, type Statement } from "./statements";

type Card = { id: string; closingDay: number | null; paymentDays: number | null; currency?: string };
type CardPurchase = { id: string; date: Date; amountCents: number; installmentCount: number; note: string | null; item: { name: string }; paymentMethod: { id: string } };

/**
 * Statements for every card from card purchases and from recurring card charges in `recurringFrom`..`recurringTo`.
 * Statements outside the windows the inputs cover may be incomplete; callers use only the months they loaded for.
 */
export function statementsForCards({ cards, purchases, definitions, overrides, recurringHistory = [], recurringFrom, recurringTo, paidStatements }: {
  cards: Card[];
  purchases: CardPurchase[];
  definitions: RecurringDefinition[];
  overrides: OccurrenceOverride[];
  recurringHistory?: ConfirmedAmount[];
  recurringFrom: MonthKey;
  recurringTo: MonthKey;
  paidStatements: { paymentMethodId: string; statementMonth: Date }[];
}): Statement[] {
  const cardDefinitions = definitions.filter((definition) => definition.paymentMethod.kind === "CARD");
  const occurrences: RecurringOccurrence[] = [];
  for (let month = recurringFrom; month <= recurringTo; month = addMonths(month, 1)) {
    occurrences.push(...occurrencesForMonth(cardDefinitions, overrides, month, recurringHistory));
  }

  return cards.flatMap((card) => {
    if (card.closingDay == null || card.paymentDays == null) return [];
    return buildStatements(
      { id: card.id, closingDay: card.closingDay, paymentDays: card.paymentDays, currency: card.currency },
      purchases
        .filter((purchase) => purchase.paymentMethod.id === card.id)
        .map((purchase) => ({ ...purchase, description: purchase.item.name })),
      occurrences
        .filter((occurrence) => occurrence.recurring.paymentMethod.id === card.id)
        .map((occurrence) => ({ id: recurringChargeId(occurrence), description: occurrence.recurring.item.name, date: occurrence.chargeDate, amountCents: occurrence.amountCents })),
      new Set(paidStatements.filter((paid) => paid.paymentMethodId === card.id).map((paid) => monthKeyOf(paid.statementMonth))),
    );
  });
}
