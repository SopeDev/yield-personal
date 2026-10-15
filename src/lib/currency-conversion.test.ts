import assert from "node:assert/strict";
import { test } from "node:test";
import { convertCents, parseRateResponse } from "./currency-conversion";

test("a rate is read from the source's response, and anything else is no rate", () => {
  assert.deepEqual(parseRateResponse({ amount: 1, base: "USD", date: "2026-10-14", rates: { MXN: 18.1736 } }, "USD", "MXN"), { rate: 18.1736, date: "2026-10-14" });
  for (const bad of [null, "oops", { base: "EUR", date: "2026-10-14", rates: { MXN: 21 } }, { base: "USD", date: "2026-10-14", rates: { MXN: -1 } }, { base: "USD", date: "yesterday", rates: { MXN: 18 } }, { base: "USD", date: "2026-10-14", rates: {} }]) {
    assert.equal(parseRateResponse(bad, "USD", "MXN"), null);
  }
  // US$120.00 at 18.1736 is $2,180.83.
  assert.equal(convertCents(12000, 18.1736), 218083);
});
