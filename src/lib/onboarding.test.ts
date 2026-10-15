import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyAnswers, planOnboarding, type OnboardingAnswers } from "./onboarding";

const answers = (changes: Partial<OnboardingAnswers>): OnboardingAnswers => ({ ...emptyAnswers("MXN"), ...changes });
const plan = (changes: Partial<OnboardingAnswers>) => {
  const result = planOnboarding(answers(changes));
  if ("error" in result) throw new Error(result.error);
  return result.plan;
};

test("skipping everything saves only the currency, counting income day by day", () => {
  assert.deepEqual(plan({}), { currency: "MXN", rhythm: { kind: "DAILY" }, salary: null, cashCents: null, cards: [], bills: [] });
  assert.deepEqual(planOnboarding(answers({ currency: "GBP" })), { error: "currency" });
});

test("a salary sets the paydays, unless income also comes in as it's earned", () => {
  const salary = { name: " Sueldo ", amount: "18,500", schedule: "TWICE_MONTHLY" as const, days: "30, 15", anchor: "" };
  const salaried = plan({ salary });
  assert.deepEqual(salaried.salary, { name: "Sueldo", amountCents: 1850000, rhythm: { kind: "MONTH_DAYS", days: [15, 30] } });
  assert.deepEqual(salaried.rhythm, { kind: "MONTH_DAYS", days: [15, 30] });
  // A salary and side income: the salary is expected on its paydays, everything else counts day by day.
  assert.deepEqual(plan({ salary, variableIncome: true }).rhythm, { kind: "DAILY" });
  assert.deepEqual(plan({ salary: { ...salary, schedule: "BIWEEKLY", anchor: "2026-10-09" } }).rhythm, { kind: "BIWEEKLY", anchor: "2026-10-09" });
  for (const bad of [{ days: "15" }, { amount: "" }, { name: "" }, { schedule: "WEEKLY" as const, anchor: "Friday" }]) {
    assert.deepEqual(planOnboarding(answers({ salary: { ...salary, ...bad } })), { error: "salary" });
  }
});

test("cash on hand, cards with their colors, and bills paid in cash or with one of the cards", () => {
  const result = plan({
    cash: "0",
    cards: [{ name: "Nu", closingDay: "5", paymentDays: "20" }, { name: "Plata", closingDay: "28", paymentDays: "10" }],
    bills: [
      { name: "Renta", amount: "11900", day: "1", card: null, variable: false },
      { name: "Luz", amount: "350", day: "15", card: 1, variable: true },
    ],
  });
  assert.equal(result.cashCents, 0);
  assert.deepEqual(result.cards.map((card) => [card.name, card.closingDay, card.paymentDays, card.color]), [["Nu", 5, 20, "#8b5cf6"], ["Plata", 28, 10, "#f97316"]]);
  assert.deepEqual(result.bills, [
    { name: "Renta", amountCents: 1190000, dayOfMonth: 1, card: null, isVariable: false },
    { name: "Luz", amountCents: 35000, dayOfMonth: 15, card: 1, isVariable: true },
  ]);
  const bill = { name: "Renta", amount: "100", day: "1", card: null, variable: false };
  assert.deepEqual(planOnboarding(answers({ bills: [{ ...bill, card: 0 }] })), { error: "bills" });
  assert.deepEqual(planOnboarding(answers({ bills: [bill, { ...bill, name: "renta" }] })), { error: "bills" });
  assert.deepEqual(planOnboarding(answers({ bills: [{ ...bill, day: "32" }] })), { error: "bills" });
  assert.deepEqual(planOnboarding(answers({ cards: [{ name: "Nu", closingDay: "5", paymentDays: "0" }] })), { error: "cards" });
  assert.deepEqual(planOnboarding(answers({ cash: "-5" })), { error: "cash" });
});
