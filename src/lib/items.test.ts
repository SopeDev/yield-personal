import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanItemName, normalizeItemName } from "./items";

test("item names match regardless of case and spacing", () => {
  assert.equal(normalizeItemName("  Gasolina "), normalizeItemName("gasolina"));
  assert.equal(normalizeItemName("Calimax   Efectivo"), "calimax efectivo");
  assert.equal(normalizeItemName("Café"), "café");
  assert.equal(cleanItemName("  Seguro   Leo "), "Seguro Leo");
});
