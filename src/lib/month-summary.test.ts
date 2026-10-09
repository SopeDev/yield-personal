import assert from "node:assert/strict";
import { test } from "node:test";
import { statementsForCards } from "./card-statements";
import type { LedgerPurchase } from "./ledger";
import { currenciesIn, forCurrency, summarizeMonth, type LedgerData } from "./month-summary";
import { dateFromKey } from "./months";
import type { RecurringDefinition } from "./recurring";
import { installmentsOwed } from "./statements";

const fixed = { id: "fixed", key: "fixed", name: null, sortOrder: 0, kind: "BILLS" as const };
const food = { id: "food", key: "food", name: null, sortOrder: 1, kind: "EVERYDAY" as const };
const car = { id: "car", key: "car", name: null, sortOrder: 2, kind: "EVERYDAY" as const };
const extras = { id: "extras", key: "extras", name: null, sortOrder: 3, kind: "OCCASIONAL" as const };
const cash = { id: "cash", kind: "CASH" as const, name: "Cash", color: "#00c896" };
const klar = { id: "klar", kind: "CARD" as const, name: "Klar", color: "#14b8a6" };
const klarCard = { id: "klar", closingDay: 20, paymentDays: 30 };

const definitions: RecurringDefinition[] = [
  { id: "rent", item: { id: "rent", name: "Renta", category: fixed }, amountCents: 800000, isVariable: false, intervalMonths: 1, dayOfMonth: 1, startMonth: dateFromKey("2026-10-01"), endMonth: null, paymentMethod: cash },
];

function purchase(id: string, date: string, amountCents: number, category: LedgerPurchase["item"]["category"], paymentMethod: LedgerPurchase["paymentMethod"], installmentCount = 1): LedgerPurchase {
  return { id, date: dateFromKey(date), amountCents, note: null, installmentCount, item: { id, name: id, category }, paymentMethod };
}

const purchases = [
  purchase("gas", "2026-10-02", 41000, car, cash),
  purchase("pho", "2026-10-04", 26000, food, cash),
  purchase("escritorio", "2026-10-10", 66600, extras, klar, 2),
];

test("summarizes spending, cash out, savings, and balance for a month", () => {
  const statements = statementsForCards({
    cards: [klarCard], purchases: purchases.filter((item) => item.paymentMethod.kind === "CARD"),
    definitions, overrides: [], recurringFrom: "2026-09", recurringTo: "2026-12", paidStatements: [],
  });
  const data: LedgerData = {
    categories: [fixed, food, car, extras],
    purchases,
    incomes: [{ id: "uber", date: dateFromKey("2026-10-01"), amountCents: 326940, note: null, source: { id: "uber", name: "Uber", groupId: "rideshare" } }],
    incomeGroups: [{ id: "rideshare", name: "Rideshare", deductCategoryIds: ["car"] }],
    definitions,
    overrides: [],
    recurringHistory: [],
    statements,
    savingsMovements: [{ id: "s", fundId: "emergency", date: dateFromKey("2026-10-20"), amountCents: 100000, note: null }],
  };

  const october = summarizeMonth(data, "2026-10");
  // Spending: rent 8,000 + food 260 + car 410 + first desk installment 333.
  assert.equal(october.spending.totalCents, 800000 + 26000 + 41000 + 33300);
  // Cash out: rent, gas, pho, 1,000 into savings, and the Klar statement closing Oct 20 (first desk installment),
  // which belongs to October even though it is due Nov 20.
  assert.equal(october.cashFlow.toPayCents, 800000 + 41000 + 26000 + 100000 + 33300);
  assert.equal(october.savingsNetCents, 100000);
  assert.equal(october.balanceCents, 326940 - october.cashFlow.toPayCents);
  assert.equal(october.income.byGroup[0].netCents, 326940 - 41000);

  const november = summarizeMonth(data, "2026-11");
  assert.equal(november.cashFlow.statementsClosing.length, 1);
  assert.equal(november.cashFlow.statementsClosing[0].totalCents, 33300);
  assert.equal(installmentsOwed(statements), 66600);
});

test("carries unpaid statements from earlier months into the current month without counting them twice", () => {
  const statements = statementsForCards({
    cards: [klarCard], purchases: purchases.filter((item) => item.paymentMethod.kind === "CARD"),
    definitions: [], overrides: [], recurringFrom: "2026-09", recurringTo: "2026-12", paidStatements: [],
  });
  const data: LedgerData = { categories: [fixed, food, car, extras], purchases, incomes: [], incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements, savingsMovements: [] };

  const november = summarizeMonth(data, "2026-11", { carryFrom: "2026-01" });
  assert.deepEqual(november.cashFlow.carriedStatements.map((statement) => statement.month), ["2026-10"]);
  assert.equal(november.cashFlow.carriedOutstandingCents, 33300);
  // November's own totals only include November's statement.
  assert.equal(november.cashFlow.toPayCents, 33300);
  assert.equal(november.cashFlow.outstandingCents, 33300);

  // Without carrying (any month other than the current one), earlier statements stay in their own month.
  assert.equal(summarizeMonth(data, "2026-11").cashFlow.carriedStatements.length, 0);

  const paid = { ...data, statements: statements.map((statement) => (statement.month === "2026-10" ? { ...statement, paid: true } : statement)) };
  assert.equal(summarizeMonth(paid, "2026-11", { carryFrom: "2026-01" }).cashFlow.carriedStatements.length, 0);
});

test("the current month carries unpaid cash bills from earlier months as outstanding", () => {
  const data: LedgerData = {
    categories: [fixed], purchases: [], incomes: [], incomeGroups: [], definitions: definitions.map((item) => ({ ...item, addedMonth: "2026-10" as const })),
    overrides: [{ recurringPaymentId: "rent", month: dateFromKey("2026-11-01"), amountCents: null, paidAt: dateFromKey("2026-11-02") }],
    recurringHistory: [], statements: [], savingsMovements: [],
  };
  const december = summarizeMonth(data, "2026-12", { carryFrom: "2025-12" });
  assert.deepEqual(december.cashFlow.carriedOccurrences.map((occurrence) => occurrence.month), ["2026-10"]);
  assert.equal(december.cashFlow.carriedOutstandingCents, 800000);
  assert.equal(december.cashFlow.outstandingCents, 800000);
  assert.equal(summarizeMonth(data, "2026-12").cashFlow.carriedOccurrences.length, 0);
});

test("each currency is summarized on its own, records without a currency counting as the main one", () => {
  const usdCash = { id: "usd", kind: "CASH" as const, name: "Dólares", color: "#00c896", currency: "USD" };
  const data: LedgerData = {
    categories: [fixed, food, car, extras],
    purchases: [purchase("gas", "2026-10-02", 41000, car, cash), purchase("tacos", "2026-10-03", 1500, food, usdCash)],
    incomes: [
      { id: "uber", date: dateFromKey("2026-10-01"), amountCents: 326940, note: null, source: { id: "uber", name: "Uber", groupId: null } },
      { id: "client", date: dateFromKey("2026-10-05"), amountCents: 50000, note: null, source: { id: "web", name: "Web", groupId: null }, currency: "USD" },
    ],
    incomeGroups: [], definitions: [], overrides: [], recurringHistory: [], statements: [], savingsMovements: [],
  };
  assert.deepEqual(currenciesIn(data, "MXN"), ["MXN", "USD"]);
  const pesos = summarizeMonth(forCurrency(data, "MXN", "MXN"), "2026-10");
  const dollars = summarizeMonth(forCurrency(data, "USD", "MXN"), "2026-10");
  assert.equal(pesos.spending.totalCents, 41000);
  assert.equal(pesos.income.totalCents, 326940);
  assert.equal(dollars.spending.totalCents, 1500);
  assert.equal(dollars.income.totalCents, 50000);
  assert.equal(dollars.cashFlow.toPayCents, 1500);
});
