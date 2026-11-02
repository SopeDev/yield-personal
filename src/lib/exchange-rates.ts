import "server-only";

import { db } from "@/db/client";
import { dateFromKey, dateInMonth, dateKeyOf, monthRange, type MonthKey } from "@/lib/months";
import { todayKey } from "@/lib/today";
import { ownRate, OWN_RATE_DAYS, parseRateResponse, type ExchangeRate, type ExchangeRates } from "./currency-conversion";

/** How long a fetched rate is used before asking again; the source publishes once a working day. */
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

/**
 * Rates from each of `currencies` to `main`, for counting money in other currencies in the main one. With `userId`,
 * the rate of the user's own latest exchange between the two while it's recent (`ownRate`); otherwise the reference
 * rate: stored while fresh, else a new one from Frankfurter (the European Central Bank's reference rates; only the
 * currency codes are sent), falling back to the stored rate when that fails. A currency with none has no rate, and
 * isn't converted.
 */
export async function loadExchangeRates(main: string, currencies: string[], userId?: string): Promise<ExchangeRates> {
  const others = [...new Set(currencies)].filter((currency) => currency !== main);
  const rates: ExchangeRates = new Map();
  if (others.length === 0) return rates;
  // The user's own latest exchange sets the rate while it's recent (`ownRate`); the reference rate covers the rest.
  if (userId) {
    const today = todayKey();
    const since = new Date(Date.parse(`${today}T00:00:00Z`) - OWN_RATE_DAYS * 86_400_000);
    const exchanges = (await db.currencyExchange.findMany({
      where: { userId, date: { gte: since }, OR: [{ fromCurrency: main, toCurrency: { in: others } }, { toCurrency: main, fromCurrency: { in: others } }] },
      select: { date: true, createdAt: true, fromCurrency: true, toCurrency: true, fromCents: true, toCents: true },
    })).map((exchange) => ({ ...exchange, date: dateKeyOf(exchange.date) }));
    for (const currency of others) {
      const own = ownRate(exchanges, main, currency, today);
      if (own) rates.set(currency, own);
    }
  }
  const reference = others.filter((currency) => !rates.has(currency));
  if (reference.length === 0) return rates;
  await addReferenceRates(main, reference, rates);
  return rates;
}

/**
 * Rates for counting each month's records in other currencies in the main one (`inMainCurrency`), by month: the
 * rate of the user's latest exchange dated in that month (what that month's dollars really cost), else the current
 * rate (`loadExchangeRates`). A month with an exchange of its own keeps its figures as the rate moves on.
 */
export async function loadMonthRates(userId: string, main: string, currencies: string[], months: MonthKey[]): Promise<Map<MonthKey, ExchangeRates>> {
  const others = [...new Set(currencies)].filter((currency) => currency !== main);
  const byMonth = new Map<MonthKey, ExchangeRates>(months.map((month) => [month, new Map()]));
  if (others.length === 0 || months.length === 0) return byMonth;
  const sorted = [...months].sort();
  const [current, exchanges] = await Promise.all([
    loadExchangeRates(main, others, userId),
    db.currencyExchange.findMany({
      where: {
        userId, date: { gte: monthRange(sorted[0]).start, lt: monthRange(sorted.at(-1)!).end },
        OR: [{ fromCurrency: main, toCurrency: { in: others } }, { toCurrency: main, fromCurrency: { in: others } }],
      },
      select: { date: true, createdAt: true, fromCurrency: true, toCurrency: true, fromCents: true, toCents: true },
    }),
  ]);
  const dated = exchanges.map((exchange) => ({ ...exchange, date: dateKeyOf(exchange.date) }));
  for (const month of months) {
    const rates = byMonth.get(month)!;
    const lastDay = dateKeyOf(dateInMonth(month, 31));
    for (const currency of others) {
      // Only exchanges in the month itself: `ownRate` looks back from its last day, so earlier ones are left out.
      const own = ownRate(dated.filter((exchange) => exchange.date >= `${month}-01`), main, currency, lastDay);
      const rate = own ?? current.get(currency);
      if (rate) rates.set(currency, rate);
    }
  }
  return byMonth;
}

/** Reference rates for `others` into `rates`: stored while fresh, else fetched, else the last stored. */
async function addReferenceRates(main: string, others: string[], rates: ExchangeRates) {
  const stored = await db.exchangeRate.findMany({ where: { quote: main, base: { in: others } } });
  await Promise.all(others.map(async (base) => {
    const row = stored.find((entry) => entry.base === base);
    if (row && Date.now() - row.fetchedAt.getTime() < FRESH_FOR_MS) {
      rates.set(base, { rate: row.rate, date: dateKeyOf(row.rateDate) });
      return;
    }
    const fetched = await fetchRate(base, main);
    if (fetched) {
      rates.set(base, fetched);
      await db.exchangeRate.upsert({
        where: { base_quote: { base, quote: main } },
        create: { base, quote: main, rate: fetched.rate, rateDate: dateFromKey(fetched.date), fetchedAt: new Date() },
        update: { rate: fetched.rate, rateDate: dateFromKey(fetched.date), fetchedAt: new Date() },
      });
    } else if (row) {
      rates.set(base, { rate: row.rate, date: dateKeyOf(row.rateDate) });
    }
  }));
  return rates;
}

async function fetchRate(base: string, quote: string): Promise<ExchangeRate | null> {
  try {
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? parseRateResponse(await response.json(), base, quote) : null;
  } catch {
    return null;
  }
}
