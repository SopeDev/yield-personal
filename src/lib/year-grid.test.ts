import assert from "node:assert/strict";
import { test } from "node:test";
import type { LedgerPurchase } from "./ledger";
import { summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";
import { buildYearGrid } from "./year-grid";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, includeInAverage: true };
const car = { id: "car", key: "car", name: null, sortOrder: 2, includeInAverage: true };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const gasolina = { id: "gasolina", name: "Gasolina", category: car };
const lavado = { id: "lavado", name: "Lavado", category: car };

function purchase(id: string, date: string, amountCents: number, item: LedgerPurchase["item"]): LedgerPurchase {
  return { id, date: dateFromKey(date), amountCents, note: null, installmentCount: 1, item, paymentMethod: cash };
}

test("builds category groups with item rows and monthly totals", () => {
  const data: LedgerData = {
    categories: [car, fixed],
    purchases: [
      purchase("g1", "2026-10-02", 41000, gasolina),
      purchase("g2", "2026-10-09", 41000, gasolina),
      purchase("g3", "2026-11-03", 41000, gasolina),
      purchase("l1", "2026-11-05", 15000, lavado),
    ],
    incomes: [],
    definitions: [
      { id: "rent", item: { id: "renta", name: "Renta", category: fixed }, amountCents: 800000, dayOfMonth: 1, startMonth: dateFromKey("2026-11-01"), endMonth: null, paymentMethod: cash },
    ],
    overrides: [],
    statements: [],
    savingsMovements: [],
  };
  const grid = buildYearGrid([summarizeMonth(data, "2026-10"), summarizeMonth(data, "2026-11")], data.categories);

  assert.deepEqual(grid.monthKeys, ["2026-10", "2026-11"]);
  assert.deepEqual(grid.groups.map((group) => group.category.id), ["fixed", "car"]);

  const [fixedGroup, carGroup] = grid.groups;
  assert.deepEqual(fixedGroup.items.map((row) => [row.item.name, row.totalsCents]), [["Renta", [0, 800000]]]);
  assert.deepEqual(carGroup.items.map((row) => [row.item.name, row.totalsCents, row.yearCents]), [
    ["Gasolina", [82000, 41000], 123000],
    ["Lavado", [0, 15000], 15000],
  ]);
  assert.deepEqual(carGroup.totalsCents, [82000, 56000]);
  assert.deepEqual(grid.spending.totalsCents, [82000, 856000]);
  assert.deepEqual(grid.balance.totalsCents, [-82000, -856000]);
});
