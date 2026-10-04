import type { LedgerCategory, LedgerPaymentMethod } from "./ledger";
import { dateInMonth, monthKeyOf, type MonthKey } from "./months";

export type RecurringDefinition = {
  id: string;
  name: string;
  amountCents: number;
  dayOfMonth: number;
  startMonth: Date;
  endMonth: Date | null;
  category: LedgerCategory;
  paymentMethod: LedgerPaymentMethod;
};

export type OccurrenceOverride = { recurringPaymentId: string; month: Date; amountCents: number | null; paidAt: Date | null };

export type RecurringOccurrence = {
  recurring: RecurringDefinition;
  month: MonthKey;
  /** The date the bill is charged: its day of the month, clamped to the month's length. */
  date: Date;
  amountCents: number;
  amountChanged: boolean;
  /** Only meaningful for cash; card occurrences are paid through their statement. */
  cashPaidAt: Date | null;
};

export function isActiveInMonth(recurring: Pick<RecurringDefinition, "startMonth" | "endMonth">, month: MonthKey) {
  return monthKeyOf(recurring.startMonth) <= month && (!recurring.endMonth || month <= monthKeyOf(recurring.endMonth));
}

export function occurrencesForMonth(definitions: RecurringDefinition[], overrides: OccurrenceOverride[], month: MonthKey): RecurringOccurrence[] {
  const overrideById = new Map(
    overrides.filter((override) => monthKeyOf(override.month) === month).map((override) => [override.recurringPaymentId, override]),
  );

  return definitions
    .filter((recurring) => isActiveInMonth(recurring, month))
    .map((recurring) => {
      const override = overrideById.get(recurring.id);
      return {
        recurring,
        month,
        date: dateInMonth(month, recurring.dayOfMonth),
        amountCents: override?.amountCents ?? recurring.amountCents,
        amountChanged: override?.amountCents != null,
        cashPaidAt: override?.paidAt ?? null,
      };
    })
    .sort((a, b) => a.recurring.dayOfMonth - b.recurring.dayOfMonth);
}
