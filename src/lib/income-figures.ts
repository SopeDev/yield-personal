import { historyWindow } from "./daily-balance";
import type { LedgerIncome, LedgerPurchase } from "./ledger";
import { dateKeyOf } from "./months";
import { PERIOD_DAYS, periodStart } from "./spending-average";

/** Today, this week (Monday on), or this month. */
export const INCOME_FRAMES = ["day", "week", "month"] as const;
export type IncomeFrame = (typeof INCOME_FRAMES)[number];
/** What an average income is per: a day with income in scope, any day, a week, or a month. */
export const INCOME_PERS = ["workday", "day", "week", "month"] as const;
export type IncomePer = (typeof INCOME_PERS)[number];
export type IncomeBasis = "gross" | "net";
/** What an income stat covers: all income, an income group, or one source. */
export type IncomeScope = { kind: "all" } | { kind: "group" | "source"; id: string };

/** "all", "group.<id>" or "source.<id>", or null. */
export function parseIncomeScope(text: string): IncomeScope | null {
  if (text === "all") return { kind: "all" };
  const dot = text.indexOf(".");
  const kind = text.slice(0, dot);
  const id = text.slice(dot + 1);
  if (dot === -1 || (kind !== "group" && kind !== "source") || !/^[\w-]+$/.test(id)) return null;
  return { kind, id };
}

export const incomeScopeParam = (scope: IncomeScope) => (scope.kind === "all" ? "all" : `${scope.kind}.${scope.id}`);

/**
 * "<frame or per>:<scope>:<basis>", like "week:group.<id>:net". Net is only offered for all income or a group, since
 * deductions belong to a group, never to one of its sources.
 */
export function parseIncomeParam<T extends string>(param: string, steps: readonly T[]): { step: T; scope: IncomeScope; basis: IncomeBasis } | null {
  const parts = param.split(":");
  if (parts.length !== 3) return null;
  const [step, scopeText, basis] = parts;
  const scope = parseIncomeScope(scopeText);
  if (!(steps as readonly string[]).includes(step) || !scope || (basis !== "gross" && basis !== "net")) return null;
  if (scope.kind === "source" && basis === "net") return null;
  return { step: step as T, scope, basis };
}

type IncomeRecords = {
  incomes: Pick<LedgerIncome, "date" | "amountCents" | "source">[];
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "item">[];
  scope: IncomeScope;
  basis: IncomeBasis;
  /** The categories whose spending comes off net income: the group's, or every group's for all income. */
  deductCategoryIds: string[];
};

/**
 * Income in scope from `fromKey` through `toKey`: gross, the deducted categories' purchases (counted in full on the
 * day bought) for net, and the days that had any of it.
 */
export function incomeBetween({ incomes, purchases, scope, basis, deductCategoryIds }: IncomeRecords, fromKey: string, toKey: string) {
  const within = (date: Date) => dateKeyOf(date) >= fromKey && dateKeyOf(date) <= toKey;
  const inScope = incomes.filter((income) => within(income.date)
    && (scope.kind === "all" || (scope.kind === "group" ? income.source.groupId === scope.id : income.source.id === scope.id)));
  const grossCents = inScope.reduce((sum, income) => sum + income.amountCents, 0);
  const deductionsCents = basis === "gross" ? 0 : purchases
    .filter((purchase) => within(purchase.date) && deductCategoryIds.includes(purchase.item.category.id))
    .reduce((sum, purchase) => sum + purchase.amountCents, 0);
  return { grossCents, deductionsCents, cents: grossCents - deductionsCents, workdays: new Set(inScope.map((income) => dateKeyOf(income.date))).size };
}

/**
 * What's usually earned per day worked, day, week or month, over the same finished days typical daily spending
 * looks back on (the last full months, from "Count history from" on), and what's come in so far in the one under
 * way (today, for a day or a day worked).
 */
export function averageIncome(records: IncomeRecords & { today: string; historyStart?: string | null; per: IncomePer }) {
  const { today, historyStart = null, per } = records;
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  const window = days < 1 ? { grossCents: 0, deductionsCents: 0, cents: 0, workdays: 0 } : incomeBetween(records, fromKey, toKey);
  const divisor = per === "workday" ? window.workdays : days;
  // From the rounded day, so the working shown for it adds up.
  const perDayCents = divisor < 1 ? 0 : Math.round(window.cents / divisor);
  const periodDays = per === "workday" ? 1 : PERIOD_DAYS[per];
  return {
    fromKey,
    days,
    ...window,
    divisor,
    perDayCents,
    averageCents: Math.round(perDayCents * periodDays),
    soFarCents: incomeBetween(records, periodStart(today, per === "workday" ? "day" : per), today).cents,
  };
}
