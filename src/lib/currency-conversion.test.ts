import assert from "node:assert/strict";
import { test } from "node:test";
import { convertCents, ownRate, parseRateResponse } from "./currency-conversion";

test("a rate is read from the source's response, and anything else is no rate", () => {
  assert.deepEqual(parseRateResponse({ amount: 1, base: "USD", date: "2026-10-14", rates: { MXN: 18.1736 } }, "USD", "MXN"), { rate: 18.1736, date: "2026-10-14" });
  for (const bad of [null, "oops", { base: "EUR", date: "2026-10-14", rates: { MXN: 21 } }, { base: "USD", date: "2026-10-14", rates: { MXN: -1 } }, { base: "USD", date: "yesterday", rates: { MXN: 18 } }, { base: "USD", date: "2026-10-14", rates: {} }]) {
    assert.equal(parseRateResponse(bad, "USD", "MXN"), null);
  }
  // US$120.00 at 18.1736 is $2,180.83.
  assert.equal(convertCents(12000, 18.1736), 218083);
});

test("the user's latest recent exchange sets the rate, in either direction, and an old one gives way to the reference rate", () => {
  const exchange = (date: string, fromCurrency: string, fromCents: number, toCurrency: string, toCents: number, created = 0) => ({
    date, createdAt: new Date(Date.parse(`${date}T12:00:00Z`) + created), fromCurrency, toCurrency, fromCents, toCents,
  });
  // Pesos for dollars on Oct 31: $9,082.50 for US$525 is $17.30 a dollar.
  const exchanges = [exchange("2026-10-02", "USD", 10000, "MXN", 180000), exchange("2026-10-31", "MXN", 908250, "USD", 52500)];
  assert.deepEqual(ownRate(exchanges, "MXN", "USD", "2026-10-31"), { rate: 17.3, date: "2026-10-31", own: true });
  // Dollars sold for pesos count the same way; the newest exchange wins.
  assert.equal(ownRate(exchanges.slice(0, 1), "MXN", "USD", "2026-10-31")?.rate, 18);
  // Older than 60 days, or in another currency: none.
  assert.equal(ownRate(exchanges, "MXN", "USD", "2027-01-15"), null);
  assert.equal(ownRate(exchanges, "MXN", "EUR", "2026-10-31"), null);
});
