import assert from "node:assert/strict";
import { test } from "node:test";
import { amountAfterInput, formatAmountInput, formatCents, parseAmountToCents } from "./money";

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

test("formats centavos as pesos", () => {
  assert.equal(formatCents(123000), "$1,230.00");
  assert.equal(formatCents(-1756060), "-$17,560.60");
});

test("formats whole pesos for dense grids", async () => {
  const { formatWholePesos } = await import("./money");
  assert.equal(formatWholePesos(123050), "$1,231");
  assert.equal(formatWholePesos(-1756060), "-$17,561");
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
