import assert from "node:assert/strict";
import { test } from "node:test";
import { amountAfterInput, currencySymbol, formatAmountInput, formatCents, formatCentsIn, formatWholeUnits, parseAmountToCents } from "./money";

test("parses amounts into centavos", () => {
  assert.equal(parseAmountToCents("410"), 41000);
  assert.equal(parseAmountToCents("1,230.5"), 123050);
  assert.equal(parseAmountToCents("$ 3,269.40"), 326940);
});

test("rejects invalid, zero, or over-precise amounts", () => {
  for (const input of ["", "abc", "0", "1.234", "-5", "1.2.3"]) {
    assert.equal(parseAmountToCents(input), null, input);
  }
});

test("formats amounts in the user's currency", () => {
  assert.equal(formatCents(123000, "MXN"), "$1,230.00");
  assert.equal(formatCents(-1756060, "MXN"), "-$17,560.60");
  assert.equal(formatCents(123000, "USD"), "$1,230.00");
  assert.equal(formatCents(123000, "EUR"), "€1,230.00");
  assert.equal(currencySymbol("CAD"), "$");
  assert.equal(currencySymbol("EUR"), "€");
});

test("amounts outside the main currency get a symbol that can't be mistaken for it", () => {
  assert.equal(formatCentsIn(30000, "USD", "MXN"), "US$300.00");
  assert.equal(formatCentsIn(30000, "MXN", "USD"), "MX$300.00");
  assert.equal(formatCentsIn(30000, "MXN", "MXN"), "$300.00");
  assert.equal(currencySymbol("USD", true), "US$");
});

test("formats whole units for dense grids", () => {
  assert.equal(formatWholeUnits(123050, "MXN"), "$1,231");
  assert.equal(formatWholeUnits(-1756060, "MXN"), "-$17,561");
});

test("the amount input fills from the right, with centavos first", () => {
  let cents = 0;
  const shown: string[] = [];
  for (const digit of "12345") {
    cents = amountAfterInput(cents, formatAmountInput(cents) + digit);
    shown.push(formatAmountInput(cents));
  }
  assert.deepEqual(shown, ["0.01", "0.12", "1.23", "12.34", "123.45"]);

  // Backspace drops the last digit; deleting only a separator still drops one.
  assert.equal(amountAfterInput(12345, "123.4"), 1234);
  assert.equal(amountAfterInput(123456, "1,23456"), 12345);
  assert.equal(amountAfterInput(1234, "12.3a"), 123);
  // Letters and symbols are ignored, and the amount is capped.
  assert.equal(amountAfterInput(123, "1.23x"), 123);
  assert.equal(amountAfterInput(999_999_999, "9,999,999.999"), 999_999_999);
});
