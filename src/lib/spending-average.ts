import { amountBetween } from "./installments";
import { isEveryday } from "./categories";
import { historyWindow } from "./daily-balance";
import type { LedgerPurchase } from "./ledger";

export const SPENDING_PERIODS = ["day", "week", "month"] as const;
export type SpendingPeriod = (typeof SPENDING_PERIODS)[number];
/** What an average spending stat covers: everyday spending, one category, or one item. */
export type SpendingScope = { kind: "all" } | { kind: "category" | "item"; id: string };

/** Days in each period; a month is 30.4 days, the average month. */
export const PERIOD_DAYS: Record<SpendingPeriod, number> = { day: 1, week: 7, month: 30.4 };

/** "week:category.<id>" and the like: a period, then "all", "category.<id>" or "item.<id>". */
export function parseSpendingParam(param: string): { period: SpendingPeriod; scope: SpendingScope } | null {
  const colon = param.indexOf(":");
  if (colon === -1) return null;
  const period = param.slice(0, colon);
  const scope = param.slice(colon + 1);
  const parsed = parseSpendingScope(scope);
  if (!(SPENDING_PERIODS as readonly string[]).includes(period) || !parsed) return null;
  return { period: period as SpendingPeriod, scope: parsed };
}

/** "all", "category.<id>" or "item.<id>", or null. */
export function parseSpendingScope(text: string): SpendingScope | null {
  if (text === "all") return { kind: "all" };
  const dot = text.indexOf(".");
  const kind = text.slice(0, dot);
  const id = text.slice(dot + 1);
  if (dot === -1 || (kind !== "category" && kind !== "item") || !/^[\w-]+$/.test(id)) return null;
  return { kind, id };
}

export function spendingParam(period: SpendingPeriod, scope: SpendingScope) {
  return `${period}:${scope.kind === "all" ? "all" : `${scope.kind}.${scope.id}`}`;
}

/** The first day of the period `today` falls in: today, the week's Monday, or the 1st of the month. */
export function periodStart(today: string, period: SpendingPeriod) {
  if (period === "day") return today;
  if (period === "month") return `${today.slice(0, 7)}-01`;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * What's usually spent per period on a scope, from the same finished days typical daily spending looks back over
 * (`historyWindow`), and what's been spent so far in the period under way (today included). Purchases count on the
 * day they were made, one in installments by the installments falling in those days (`amountBetween`); "all" means
 * everyday spending, as in a typical day.
 */
export function averageSpending({ purchases, today, historyStart = null, period, scope }: {
  purchases: (Pick<LedgerPurchase, "date" | "amountCents" | "item"> & { installmentCount?: number })[];
  today: string;
  historyStart?: string | null;
  period: SpendingPeriod;
  scope: SpendingScope;
}) {
  const inScope = purchases.filter((purchase) => scope.kind === "all" ? isEveryday(purchase.item.category)
    : scope.kind === "category" ? purchase.item.category.id === scope.id : purchase.item.id === scope.id);
  const total = (fromKey: string, toKey: string) => inScope.reduce((sum, purchase) => sum + amountBetween(purchase, fromKey, toKey), 0);
  const { fromKey, toKey, days } = historyWindow(today, historyStart);
  const totalCents = days < 1 ? 0 : total(fromKey, toKey);
  // From the rounded day, so the working shown for it adds up.
  const perDayCents = days < 1 ? 0 : Math.round(totalCents / days);
  return {
    fromKey,
    days,
    totalCents,
    perDayCents,
    averageCents: Math.round(perDayCents * PERIOD_DAYS[period]),
    soFarCents: total(periodStart(today, period), today),
  };
}
