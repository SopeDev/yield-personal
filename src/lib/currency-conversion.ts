/**
 * A rate to the main currency: how many of its units one unit of the other currency buys, as of `date`. `own` when
 * it's the rate of the user's own latest exchange rather than the reference rate.
 */
export type ExchangeRate = { rate: number; date: string; own?: true };

/** How long the user's own latest exchange sets the rate before the reference rate takes over again. */
export const OWN_RATE_DAYS = 60;

/**
 * The rate of the user's latest exchange between `main` and `currency` (in either direction) dated within the last
 * `OWN_RATE_DAYS` days, or null. Valuing money in another currency at the rate it was really bought or sold at means
 * changing money never makes cash on hand go up or down by itself, as the reference rate (which no exchange house
 * pays) would.
 */
export function ownRate(
  exchanges: { date: string; createdAt: Date; fromCurrency: string; toCurrency: string; fromCents: number; toCents: number }[],
  main: string, currency: string, today: string,
): ExchangeRate | null {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - OWN_RATE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const latest = exchanges
    .filter((exchange) => exchange.date >= since && exchange.date <= today && exchange.fromCents > 0 && exchange.toCents > 0
      && ((exchange.fromCurrency === main && exchange.toCurrency === currency) || (exchange.fromCurrency === currency && exchange.toCurrency === main)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return null;
  const rate = latest.fromCurrency === main ? latest.fromCents / latest.toCents : latest.toCents / latest.fromCents;
  return { rate, date: latest.date, own: true };
}
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
