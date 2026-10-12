import assert from "node:assert/strict";
import { test } from "node:test";
import { entryMatches, filteredTotals, searchText, type FilterableEntry } from "./entry-filter";

const entry = (kind: FilterableEntry["kind"], text: string, cents: number, { categoryId = null as string | null, currency = "MXN" } = {}): FilterableEntry =>
  ({ kind, text: searchText(text), categoryId, cents, currency });

const gas = entry("purchase", "Gasolina Car Nu", 41000, { categoryId: "car" });
const cafe = entry("purchase", "Café Food Cash con Ana", 6500, { categoryId: "food" });
const didi = entry("income", "Didi Income", 120000);
const ride = entry("income", "Ride Income", 2000, { currency: "USD" });

test("search ignores case and accents, and needs every word", () => {
  assert.equal(searchText("  Café  ", "Gasolína", null), "cafe gasolina");
  assert.equal(entryMatches(cafe, { query: "CAFE", categoryId: null }), true);
  assert.equal(entryMatches(cafe, { query: "café ana", categoryId: null }), true);
  assert.equal(entryMatches(cafe, { query: "café nu", categoryId: null }), false);
  assert.equal(entryMatches(gas, { query: "  ", categoryId: null }), true);
});

test("a category keeps only purchases in it, along with any search", () => {
  assert.equal(entryMatches(gas, { query: "", categoryId: "car" }), true);
  assert.equal(entryMatches(cafe, { query: "", categoryId: "car" }), false);
  assert.equal(entryMatches(didi, { query: "", categoryId: "car" }), false);
  assert.equal(entryMatches(gas, { query: "nu", categoryId: "car" }), true);
});

test("filtered totals add spending and income in the main currency, counting every entry", () => {
  assert.deepEqual(filteredTotals([gas, cafe, didi, ride], "MXN"), { count: 4, spentCents: 47500, receivedCents: 120000 });
  assert.deepEqual(filteredTotals([], "MXN"), { count: 0, spentCents: 0, receivedCents: 0 });
});
