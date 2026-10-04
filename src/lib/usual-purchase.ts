/** How many of an item's latest purchases decide its usual payment method and amount. */
export const USUAL_HISTORY_SIZE = 5;

export type PastPurchase = { itemId: string; paymentMethodId: string; amountCents: number };

/** An item's usual payment method and amount, prefilled when it is chosen in quick add. */
export type UsualPurchase = { paymentMethodId: string; amountCents: number };

/** The most frequent value, preferring the most recent on ties; `values` are newest first. */
function mostFrequent<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return values.reduce((best, value) => (counts.get(value)! > counts.get(best)! ? value : best));
}

/**
 * Each item's usual purchase from its latest purchases (`purchases` newest first): the payment method and
 * amount used most often among them, or the latest when none repeats.
 */
export function usualPurchases(purchases: PastPurchase[]): Record<string, UsualPurchase> {
  const recentByItem = new Map<string, PastPurchase[]>();
  for (const purchase of purchases) {
    const recent = recentByItem.get(purchase.itemId) ?? [];
    if (recent.length < USUAL_HISTORY_SIZE) recentByItem.set(purchase.itemId, [...recent, purchase]);
  }
  return Object.fromEntries(
    [...recentByItem].map(([itemId, recent]) => [itemId, {
      paymentMethodId: mostFrequent(recent.map((purchase) => purchase.paymentMethodId)),
      amountCents: mostFrequent(recent.map((purchase) => purchase.amountCents)),
    }]),
  );
}
