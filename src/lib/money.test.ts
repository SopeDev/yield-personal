import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCents, parseAmountToCents } from "./money";

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
