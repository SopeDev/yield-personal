/** A rate to the main currency: how many of its units one unit of the other currency buys, as of `date`. */
export type ExchangeRate = { rate: number; date: string };
/** Rates to the main currency, by the other currency's code. */
export type ExchangeRates = Map<string, ExchangeRate>;

/** An amount in another currency in the main one, rounded to the cent. */
export function convertCents(cents: number, rate: number) {
  return Math.round(cents * rate);
}

/**
 * The rate in a Frankfurter response (`/v1/latest?base=USD&symbols=MXN` →
 * `{ "base": "USD", "date": "2026-10-14", "rates": { "MXN": 18.17 } }`), or null when it isn't one.
 */
export function parseRateResponse(body: unknown, base: string, quote: string): ExchangeRate | null {
  if (!body || typeof body !== "object") return null;
  const { base: bodyBase, date, rates } = body as { base?: unknown; date?: unknown; rates?: Record<string, unknown> };
  const rate = rates?.[quote];
  if (bodyBase !== base || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof rate !== "number" || !(rate > 0) || !Number.isFinite(rate)) return null;
  return { rate, date };
}
