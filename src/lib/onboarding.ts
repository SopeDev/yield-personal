import { isDateKey } from "./months";
import { isCurrency, parseAmountToCents, type Currency } from "./money";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "./payment-methods";
import { MAX_PAYMENT_DAYS } from "./statements";

/** Common fixed bills offered to tap in the wizard, named in the user's language; the variable ones start as estimates. */
export const BILL_PRESETS = ["rent", "electricity", "water", "gas", "internet", "phone", "streaming", "gym", "insurance", "school"] as const;
export type BillPreset = (typeof BILL_PRESETS)[number];
export const VARIABLE_BILLS: readonly BillPreset[] = ["electricity", "water", "gas"];

/**
 * Everyday categories offered to tap in the wizard. Food and car are built-in (their names follow the language);
 * the others are created with their name in the language the wizard was in.
 */
export const CATEGORY_SUGGESTIONS = ["food", "transport", "car", "home", "health", "fun", "pets", "kids", "personal"] as const;
export type CategorySuggestion = (typeof CATEGORY_SUGGESTIONS)[number];
export const BUILT_IN_SUGGESTIONS: readonly CategorySuggestion[] = ["food", "car"];
export const MAX_ONBOARDING_CATEGORIES = 12;

/** How a salary is paid: on one or two days of the month, or every week or two from a payday. */
export const SALARY_SCHEDULES = ["MONTHLY", "TWICE_MONTHLY", "WEEKLY", "BIWEEKLY"] as const;
export type SalarySchedule = (typeof SALARY_SCHEDULES)[number];

const MAX_NAME_LENGTH = 40;
export const MAX_ONBOARDING_CARDS = 6;
export const MAX_ONBOARDING_BILLS = 20;

/** What the wizard collects, as typed: amounts and days are text until checked. Everything is optional. */
export type OnboardingAnswers = {
  currency: string;
  salary: { name: string; amount: string; schedule: SalarySchedule; days: string; anchor: string } | null;
  variableIncome: boolean;
  /** Roughly how much varying income comes in a month; empty when not given. */
  incomeEstimate: string;
  cash: string;
  cards: { name: string; closingDay: string; paymentDays: string }[];
  /** `card` is the index of one of `cards`, or null for cash. */
  bills: { name: string; amount: string; day: string; card: number | null; variable: boolean }[];
  /**
   * The everyday categories to start with, each with roughly how much is spent on it a month (empty when not given):
   * a built-in one by its key, or one named by the user. None means food alone.
   */
  categories: { key: "food" | "car" | null; name: string; estimate: string }[];
};

/** What the answers save: every amount in cents and every day checked. */
export type OnboardingPlan = {
  currency: Currency;
  /** Paydays for the per-payday stats: daily whenever income also comes in as it's earned. */
  rhythm: { kind: "DAILY" } | { kind: "MONTH_DAYS"; days: number[] } | { kind: "WEEKLY" | "BIWEEKLY"; anchor: string };
  salary: { name: string; amountCents: number; rhythm: { kind: "MONTH_DAYS"; days: number[] } | { kind: "WEEKLY" | "BIWEEKLY"; anchor: string } } | null;
  cashCents: number | null;
  cards: { name: string; closingDay: number; paymentDays: number; color: string }[];
  bills: { name: string; amountCents: number; dayOfMonth: number; card: number | null; isVariable: boolean }[];
  incomeEstimateCents: number | null;
  categories: { key: "food" | "car" | null; name: string | null; monthlyEstimateCents: number | null }[];
};

const day = (text: string, max = MAX_STATEMENT_DAY) => {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
};
const name = (text: string) => {
  const value = text.trim().replace(/\s+/g, " ");
  return value && value.length <= MAX_NAME_LENGTH ? value : null;
};

/** Pay days of the month from "15, 30": one for a monthly salary, two for twice a month. */
function payDays(text: string, count: number) {
  const days = [...new Set(text.split(/[\s,;]+/).filter(Boolean).map((part) => day(part)))];
  if (days.length !== count || days.some((value) => value === null)) return null;
  return (days as number[]).sort((a, b) => a - b);
}

/**
 * The answers checked and turned into what gets saved, or the first step with a problem. The wizard checks each
 * step as it goes; this is the server's own check of the whole thing.
 */
export function planOnboarding(answers: OnboardingAnswers): { plan: OnboardingPlan } | { error: "currency" | "salary" | "cash" | "cards" | "bills" | "categories" | "estimates" } {
  if (!isCurrency(answers.currency)) return { error: "currency" };

  let salary: OnboardingPlan["salary"] = null;
  if (answers.salary) {
    const salaryName = name(answers.salary.name);
    const amountCents = parseAmountToCents(answers.salary.amount);
    const { schedule } = answers.salary;
    const rhythm = schedule === "MONTHLY" || schedule === "TWICE_MONTHLY"
      ? (() => {
        const days = payDays(answers.salary!.days, schedule === "MONTHLY" ? 1 : 2);
        return days && { kind: "MONTH_DAYS" as const, days };
      })()
      : (schedule === "WEEKLY" || schedule === "BIWEEKLY") && isDateKey(answers.salary.anchor) ? { kind: schedule, anchor: answers.salary.anchor } : null;
    if (!salaryName || !amountCents || !rhythm) return { error: "salary" };
    salary = { name: salaryName, amountCents, rhythm };
  }

  // Empty is skipped; zero is a count like any other.
  const cashText = answers.cash.trim();
  const cashCents = cashText === "" ? null : /^0+(\.0{1,2})?$/.test(cashText) ? 0 : parseAmountToCents(cashText);
  if (cashText !== "" && cashCents === null) return { error: "cash" };

  if (answers.cards.length > MAX_ONBOARDING_CARDS) return { error: "cards" };
  const cards: OnboardingPlan["cards"] = [];
  for (const [index, card] of answers.cards.entries()) {
    const cardName = name(card.name);
    const closingDay = day(card.closingDay);
    const paymentDays = day(card.paymentDays, MAX_PAYMENT_DAYS);
    if (!cardName || !closingDay || !paymentDays) return { error: "cards" };
    cards.push({ name: cardName, closingDay, paymentDays, color: CARD_COLORS[index % CARD_COLORS.length] });
  }

  if (answers.bills.length > MAX_ONBOARDING_BILLS) return { error: "bills" };
  const bills: OnboardingPlan["bills"] = [];
  const billNames = new Set<string>();
  for (const bill of answers.bills) {
    const billName = name(bill.name);
    const amountCents = parseAmountToCents(bill.amount);
    const dayOfMonth = day(bill.day);
    const card = bill.card === null ? null : Number.isInteger(bill.card) && bill.card >= 0 && bill.card < cards.length ? bill.card : -1;
    // Two bills of the same name would be the same item.
    const key = billName?.toLocaleLowerCase();
    if (!billName || !amountCents || !dayOfMonth || card === -1 || billNames.has(key!)) return { error: "bills" };
    billNames.add(key!);
    bills.push({ name: billName, amountCents, dayOfMonth, card, isVariable: bill.variable });
  }

  // Only varying income has an estimate: a salary's paydays are known.
  const incomeText = answers.incomeEstimate.trim();
  const incomeEstimateCents = !answers.variableIncome || incomeText === "" ? null : parseAmountToCents(incomeText);
  if (answers.variableIncome && incomeText !== "" && incomeEstimateCents === null) return { error: "estimates" };
  if (answers.categories.length > MAX_ONBOARDING_CATEGORIES) return { error: "categories" };
  const categories: OnboardingPlan["categories"] = [];
  const categoryNames = new Set<string>();
  for (const category of answers.categories) {
    const categoryName = category.key ? null : name(category.name);
    const estimateText = category.estimate.trim();
    const monthlyEstimateCents = estimateText === "" ? null : parseAmountToCents(estimateText);
    const unique = category.key ?? categoryName?.toLocaleLowerCase();
    if ((category.key === null && !categoryName) || !unique || categoryNames.has(unique)) return { error: "categories" };
    if (estimateText !== "" && monthlyEstimateCents === null) return { error: "estimates" };
    categoryNames.add(unique);
    categories.push({ key: category.key, name: categoryName, monthlyEstimateCents });
  }
  // Anything bought needs a category: with none picked, food.
  if (categories.length === 0) categories.push({ key: "food", name: null, monthlyEstimateCents: null });

  // Income that comes in as it's earned counts day by day, alongside any salary's paydays.
  const rhythm: OnboardingPlan["rhythm"] = salary && !answers.variableIncome ? salary.rhythm : { kind: "DAILY" };
  return { plan: { currency: answers.currency, rhythm, salary, cashCents, cards, bills, incomeEstimateCents, categories } };
}

/** Nothing set up: what skipping the whole wizard saves. */
export function emptyAnswers(currency: string): OnboardingAnswers {
  return { currency, salary: null, variableIncome: false, incomeEstimate: "", cash: "", cards: [], bills: [], categories: [] };
}

/** The setup checklist's steps, done or not, from what the account holds. */
export type SetupChecklist = { cash: boolean; bills: boolean; cards: boolean; expense: boolean };

export const checklistDone = (checklist: SetupChecklist) => Object.values(checklist).every(Boolean);

