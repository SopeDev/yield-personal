import type { LedgerItem, LedgerPaymentMethod } from "./ledger";
import { addMonths, dateInMonth, monthDifference, monthKeyOf, type MonthKey } from "./months";

export type RecurringDefinition = {
  id: string;
  /** Its expense item gives the bill its name and category. */
  item: LedgerItem;
  /** The usual amount; for a variable bill, the fallback estimate when there is no confirmed history yet. */
  amountCents: number;
  isVariable: boolean;
  /** Repeats every this many months, counted from `startMonth` (2 for bimonthly bills like CFE). */
  intervalMonths: number;
  dayOfMonth: number;
  startMonth: Date;
  endMonth: Date | null;
  paymentMethod: LedgerPaymentMethod;
  /** The month it was added to the app. Earlier months were paid before it was tracked, so they are never carried as unpaid. */
  addedMonth?: MonthKey;
};

export type OccurrenceOverride = { recurringPaymentId: string; month: Date; amountCents: number | null; paidAt: Date | null };

/** A month's real amount of an item's recurring bill, used to estimate variable bills. */
export type ConfirmedAmount = { itemId: string; month: Date; amountCents: number };

export const MAX_INTERVAL_MONTHS = 12;

/** Variable bills are estimated from the average of this many most recent confirmed amounts. */
export const ESTIMATE_HISTORY_SIZE = 3;

export type RecurringOccurrence = {
  recurring: RecurringDefinition;
  month: MonthKey;
  /** The date the bill is charged: its day of the month, clamped to the month's length. */
  date: Date;
  amountCents: number;
  /** A fixed bill whose amount was changed for this month only. */
  amountChanged: boolean;
  /** A variable bill whose amount for this month hasn't been confirmed yet. */
  estimated: boolean;
  /** Only meaningful for cash; card occurrences are paid through their statement. */
  cashPaidAt: Date | null;
};

/** Whether the bill falls in a month: within its start and end, and on its every-N-months cycle. */
export function isActiveInMonth(recurring: Pick<RecurringDefinition, "startMonth" | "endMonth" | "intervalMonths">, month: MonthKey) {
  const offset = monthDifference(monthKeyOf(recurring.startMonth), month);
  return offset >= 0 && offset % recurring.intervalMonths === 0 && (!recurring.endMonth || month <= monthKeyOf(recurring.endMonth));
}

/** The first month on or after `from` in which the bill falls, or null if it has ended by then. */
export function nextActiveMonth(recurring: Pick<RecurringDefinition, "startMonth" | "endMonth" | "intervalMonths">, from: MonthKey): MonthKey | null {
  const start = monthKeyOf(recurring.startMonth);
  const offset = Math.max(0, monthDifference(start, from));
  const remainder = offset % recurring.intervalMonths;
  const next = addMonths(start, remainder === 0 ? offset : offset + recurring.intervalMonths - remainder);
  return !recurring.endMonth || next <= monthKeyOf(recurring.endMonth) ? next : null;
}

/** Average of the item's most recent confirmed amounts before `month`, or null without history. */
export function estimateFromHistory(history: ConfirmedAmount[], itemId: string, month: MonthKey) {
  const recent = history
    .filter((entry) => entry.itemId === itemId && monthKeyOf(entry.month) < month)
    .sort((a, b) => b.month.getTime() - a.month.getTime())
    .slice(0, ESTIMATE_HISTORY_SIZE);
  if (recent.length === 0) return null;
  return Math.round(recent.reduce((sum, entry) => sum + entry.amountCents, 0) / recent.length);
}

export function occurrencesForMonth(
  definitions: RecurringDefinition[],
  overrides: OccurrenceOverride[],
  month: MonthKey,
  history: ConfirmedAmount[] = [],
): RecurringOccurrence[] {
  const overrideById = new Map(
    overrides.filter((override) => monthKeyOf(override.month) === month).map((override) => [override.recurringPaymentId, override]),
  );

  return definitions
    .filter((recurring) => isActiveInMonth(recurring, month))
    .map((recurring) => {
      const override = overrideById.get(recurring.id);
      const confirmedCents = override?.amountCents ?? null;
      const expectedCents = recurring.isVariable
        ? (estimateFromHistory(history, recurring.item.id, month) ?? recurring.amountCents)
        : recurring.amountCents;
      return {
        recurring,
        month,
        date: dateInMonth(month, recurring.dayOfMonth),
        amountCents: confirmedCents ?? expectedCents,
        amountChanged: !recurring.isVariable && confirmedCents !== null,
        estimated: recurring.isVariable && confirmedCents === null,
        cashPaidAt: override?.paidAt ?? null,
      };
    })
    .sort((a, b) => a.recurring.dayOfMonth - b.recurring.dayOfMonth || a.recurring.item.name.localeCompare(b.recurring.item.name));
}

/**
 * Cash occurrences from `from` up to (not including) `to` that are still unpaid, oldest first. Card occurrences
 * are carried through their statements instead, and months before a bill was added to the app are skipped.
 */
export function unpaidCashOccurrences(
  definitions: RecurringDefinition[],
  overrides: OccurrenceOverride[],
  from: MonthKey,
  to: MonthKey,
  history: ConfirmedAmount[] = [],
): RecurringOccurrence[] {
  const cashDefinitions = definitions.filter((recurring) => recurring.paymentMethod.kind === "CASH");
  return Array.from({ length: Math.max(0, monthDifference(from, to)) }, (_, index) => addMonths(from, index)).flatMap((month) =>
    occurrencesForMonth(cashDefinitions, overrides, month, history).filter(
      (occurrence) => occurrence.cashPaidAt === null && (!occurrence.recurring.addedMonth || month >= occurrence.recurring.addedMonth),
    ),
  );
}
