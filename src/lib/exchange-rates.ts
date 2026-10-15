import "server-only";

import { db } from "@/db/client";
import { dateFromKey, dateKeyOf } from "@/lib/months";
import { parseRateResponse, type ExchangeRate, type ExchangeRates } from "./currency-conversion";

/** How long a fetched rate is used before asking again; the source publishes once a working day. */
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

/**
 * Rates from each of `currencies` to `main`, for counting balances in other currencies in the main one: the stored
 * rate while it's fresh, else a new one from Frankfurter (the European Central Bank's reference rates; only the
 * currency codes are sent), falling back to the stored rate when that fails. A currency with neither has no rate, and
 * isn't converted.
 */
export async function loadExchangeRates(main: string, currencies: string[]): Promise<ExchangeRates> {
  const others = [...new Set(currencies)].filter((currency) => currency !== main);
  const rates: ExchangeRates = new Map();
  if (others.length === 0) return rates;
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
