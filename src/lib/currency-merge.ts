import { convertCents, type ExchangeRates } from "./currency-conversion";
import { currenciesIn, forCurrency, type LedgerData } from "./month-summary";

/**
 * A ledger's records all in the main currency: its own, plus those in each other currency with a rate in `rates`
 * converted at it (purchases, recurring bills and their monthly amounts, card statements, income, savings). A
 * currency with no rate stays out, to be noted beside the figures as before. Converted income keeps its own amount in
 * `original`, to say so where it's listed. Lists keep showing records in their own currencies; this is for figures.
 */
export function inMainCurrency(data: LedgerData, mainCurrency: string, rates: ExchangeRates): LedgerData {
  const merged = forCurrency(data, mainCurrency, mainCurrency);
  const others = currenciesIn(data, mainCurrency).filter((code) => code !== mainCurrency && rates.has(code));
  if (others.length === 0) return merged;

  const overrides = new Map(data.overrides.map((override) => [override, override]));
  const history = new Map(data.recurringHistory.map((entry) => [entry, entry]));
  const parts = others.map((code) => {
    const rate = rates.get(code)!.rate;
    const own = forCurrency(data, code, mainCurrency);
    const convert = (cents: number) => convertCents(cents, rate);
    const asMain = <T extends { currency?: string }>(method: T) => ({ ...method, currency: mainCurrency });
    // A bill's monthly amounts and its item's confirmed history are in its currency too.
    const definitionIds = new Set(own.definitions.map((definition) => definition.id));
    const itemIds = new Set(own.definitions.map((definition) => definition.item.id));
    for (const override of data.overrides) {
      if (definitionIds.has(override.recurringPaymentId)) {
        overrides.set(override, { ...override, amountCents: override.amountCents === null ? null : convert(override.amountCents) });
      }
    }
    for (const entry of data.recurringHistory) {
      if (itemIds.has(entry.itemId)) history.set(entry, { ...entry, amountCents: convert(entry.amountCents) });
    }
    const income = (record: LedgerData["incomes"][number]) => ({ ...record, amountCents: convert(record.amountCents), currency: mainCurrency, original: { currency: code, cents: record.amountCents } });
    return {
      purchases: own.purchases.map((purchase) => ({ ...purchase, amountCents: convert(purchase.amountCents), paymentMethod: asMain(purchase.paymentMethod) })),
      definitions: own.definitions.map((definition) => ({ ...definition, amountCents: convert(definition.amountCents), paymentMethod: asMain(definition.paymentMethod) })),
      incomes: own.incomes.map(income),
      expectedIncomes: (own.expectedIncomes ?? []).map(income),
      statements: own.statements.map((statement) => ({
        ...statement, currency: mainCurrency, totalCents: convert(statement.totalCents),
        charges: statement.charges.map((charge) => ({ ...charge, amountCents: convert(charge.amountCents) })),
      })),
      savingsMovements: own.savingsMovements.map((movement) => ({ ...movement, amountCents: convert(movement.amountCents), currency: mainCurrency })),
    };
  });
  return {
    ...merged,
    purchases: [...merged.purchases, ...parts.flatMap((part) => part.purchases)],
    definitions: [...merged.definitions, ...parts.flatMap((part) => part.definitions)],
    overrides: [...overrides.values()],
    recurringHistory: [...history.values()],
    incomes: [...merged.incomes, ...parts.flatMap((part) => part.incomes)],
    expectedIncomes: [...(merged.expectedIncomes ?? []), ...parts.flatMap((part) => part.expectedIncomes)],
    statements: [...merged.statements, ...parts.flatMap((part) => part.statements)],
    savingsMovements: [...merged.savingsMovements, ...parts.flatMap((part) => part.savingsMovements)],
  };
}
