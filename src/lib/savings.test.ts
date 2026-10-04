import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFromKey } from "./months";
import { emergencyFundGoal, fundBalance, netSavingsInMonth } from "./savings";

const movements = [
  { id: "1", fundId: "emergency", date: dateFromKey("2026-10-15"), amountCents: 500000, note: null },
  { id: "2", fundId: "emergency", date: dateFromKey("2026-11-02"), amountCents: -100000, note: null },
  { id: "3", fundId: "trip", date: dateFromKey("2026-11-05"), amountCents: 200000, note: null },
];

test("balances and monthly net savings", () => {
  assert.equal(fundBalance(movements, "emergency"), 400000);
  assert.equal(netSavingsInMonth(movements, "2026-10"), 500000);
  assert.equal(netSavingsInMonth(movements, "2026-11"), 100000);
});

test("reproduces the spreadsheet's savings goal", () => {
  // Gastos mensuales 15,235 × 3 = 45,705; plus MSI 3,188 = 48,893.
  assert.deepEqual(
    emergencyFundGoal({ averageMonthlyCents: 1523500, coverMonths: 3, installmentsOwedCents: 318800, balanceCents: 0 }),
    { emergencyCents: 4570500, goalCents: 4889300, pendingCents: 4889300 },
  );
  assert.equal(emergencyFundGoal({ averageMonthlyCents: 100, coverMonths: 3, installmentsOwedCents: 0, balanceCents: 1000 }).pendingCents, 0);
});
