import { DAYS_PER_MONTH, historyWindow } from "./daily-balance";
import type { Estimates } from "./stats";
import { averageSpending } from "./spending-average";
import type { LedgerPurchase } from "./ledger";

/** Days of records before estimates are compared with them: fewer would mostly be noise. */
export const ESTIMATE_CHECK_FROM_DAYS = 7;
/** Days of records after which the comparison is no longer shown. */
export const ESTIMATE_CHECK_UNTIL_DAYS = 45;

export type EstimateCheck = {
  days: number;
  spending: { categoryId: string; estimatedCents: number; paceCents: number }[];
  income: { estimatedCents: number; paceCents: number } | null;
};

/**
 * Each starting estimate beside what the records so far come to a month, once there's a week of them and until about
 * six weeks: "you estimated 10,000 a month on food; you're on pace for 13,400". Null outside that time, or with no
 * estimates. `incomePerDayCents` is the pace of varying income from records alone.
 */
export function estimateCheck({ estimates, purchases, today, historyStart, incomePerDayCents }: {
  estimates: Estimates;
  purchases: Pick<LedgerPurchase, "date" | "amountCents" | "item">[];
  today: string;
  historyStart: string | null;
  incomePerDayCents: number;
}): EstimateCheck | null {
  const { days } = historyWindow(today, historyStart);
  if (days < ESTIMATE_CHECK_FROM_DAYS || days > ESTIMATE_CHECK_UNTIL_DAYS) return null;
  if (estimates.spending.length === 0 && estimates.incomeMonthlyCents <= 0) return null;
  return {
    days,
    spending: estimates.spending.map((estimate) => ({
      categoryId: estimate.categoryId,
      estimatedCents: estimate.monthlyCents,
      paceCents: averageSpending({ purchases, today, historyStart, period: "month", scope: { kind: "category", id: estimate.categoryId } }).averageCents,
    })),
    income: estimates.incomeMonthlyCents > 0 ? { estimatedCents: estimates.incomeMonthlyCents, paceCents: Math.round(incomePerDayCents * DAYS_PER_MONTH) } : null,
  };
}
