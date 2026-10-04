import assert from "node:assert/strict";
import { test } from "node:test";
import { monthSpendingEntries, spendingAmountsOf, summarizeIncome, summarizeSpending, type LedgerCategory, type LedgerPurchase } from "./ledger";
import { dateFromKey } from "./months";

const categories: LedgerCategory[] = [
  { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true },
  { id: "food", key: "food", name: null, sortOrder: 1, includeInAverage: true },
  { id: "car", key: "car", name: null, sortOrder: 2, includeInAverage: true },
  { id: "extras", key: "extras", name: null, sortOrder: 3, includeInAverage: false },
];
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const klar = { id: "klar", kind: "CARD" as const, name: "Klar", color: "#14b8a6" };

function purchase(id: string, date: string, amountCents: number, categoryId: string, installmentCount = 1): LedgerPurchase {
  const category = categories.find((item) => item.id === categoryId)!;
  // Items are named by the id's prefix, so "gas-1".."gas-3" are all the same "gas" item.
  const itemId = id.split("-")[0];
  return { id, date: dateFromKey(date), amountCents, note: null, installmentCount, item: { id: itemId, name: itemId, category }, paymentMethod: installmentCount > 1 ? klar : cash };
}

// October from the MFP spreadsheet, recorded as individual purchases.
const october = [
  purchase("gas-1", "2026-10-02", 41000, "car"),
  purchase("gas-2", "2026-10-09", 41000, "car"),
  purchase("gas-3", "2026-10-16", 41000, "car"),
  purchase("pho", "2026-10-04", 26000, "food"),
  purchase("calimax", "2026-10-06", 19500, "food"),
  purchase("misc", "2026-10-07", 18000, "food"),
  purchase("escritorio", "2026-10-10", 66600, "extras", 2),
];

test("totals each category, counting installment purchases one installment per month", () => {
  const spending = summarizeSpending(spendingAmountsOf(monthSpendingEntries(october, "2026-10")), categories);
  assert.deepEqual(spending.byCategory.map((item) => item.totalCents), [0, 63500, 123000, 33300]);
  assert.equal(spending.totalCents, 219800);
  assert.equal(spending.carCents, 123000);

  // All three fill-ups add up under the single "gas" item, as in the spreadsheet's Gasolina row.
  assert.deepEqual(spending.byItem.find((item) => item.item.id === "gas")?.totalCents, 123000);

  const november = summarizeSpending(spendingAmountsOf(monthSpendingEntries(october, "2026-11")), categories);
  assert.equal(november.totalCents, 33300);
});

test("lists entries newest first", () => {
  const entries = monthSpendingEntries(october, "2026-10");
  assert.equal(entries[0].purchase.id, "gas-3");
});

test("nets rideshare income against all car spending", () => {
  const uber = { id: "uber", name: "Uber", isRideshare: true };
  const didi = { id: "didi", name: "Didi", isRideshare: true };
  const web = { id: "web", name: "Clientes Web", isRideshare: false };
  const income = summarizeIncome(
    [
      { id: "1", date: dateFromKey("2026-10-01"), amountCents: 167697, note: null, source: uber },
      { id: "2", date: dateFromKey("2026-10-01"), amountCents: 159243, note: null, source: didi },
      { id: "3", date: dateFromKey("2026-10-03"), amountCents: 50000, note: null, source: web },
    ],
    123000,
  );
  assert.equal(income.totalCents, 376940);
  assert.equal(income.rideshareGrossCents, 326940);
  assert.equal(income.netRideshareCents, 203940);
});
