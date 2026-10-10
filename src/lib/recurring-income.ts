import { incomeRhythmOf, paydaysInMonth, type IncomeRhythm, type IncomeRhythmKind } from "./income-rhythm";
import type { LedgerIncome, LedgerIncomeSource } from "./ledger";
import { dateKeyOf, type MonthKey } from "./months";

/** A schedule recurring income follows: any income rhythm but daily. */
export type RecurringIncomeRhythm = Exclude<IncomeRhythm, { kind: "DAILY" }>;

export type RecurringIncomeDefinition = {
  id: string;
  source: LedgerIncomeSource;
  amountCents: number;
  /** Received into the cash wallet of this currency (none: the main currency). */
  currency?: string;
  rhythm: RecurringIncomeRhythm;
  /** "YYYY-MM-DD": paydays before it are never expected. */
  startsOn: string;
};

/** Income recorded as received for a recurring income's payday (`expectedOn`). */
export type ReceivedIncome = Pick<LedgerIncome, "id" | "date" | "amountCents" | "recurringIncomeId" | "expectedOn">;

export type ExpectedPayday = {
  recurring: RecurringIncomeDefinition;
  /** The payday, "YYYY-MM-DD". */
  date: string;
  /** The income received for it, or null while it is still expected. */
  received: ReceivedIncome | null;
};

/** The schedule as stored; null when it would be daily or is incomplete (no anchor or no days). */
export function recurringIncomeRhythmOf(parts: { kind: IncomeRhythmKind; anchor: string | null; days: number[] }): RecurringIncomeRhythm | null {
  const rhythm = incomeRhythmOf(parts);
  return rhythm.kind === "DAILY" ? null : rhythm;
}

/**
 * The day a recurring income added or rescheduled on `today` starts counting paydays: today, or a weekly schedule's
 * first payday when it is still to come. Earlier paydays were received before it was tracked.
 */
export function recurringIncomeStart(rhythm: RecurringIncomeRhythm, today: string) {
  return rhythm.kind !== "MONTH_DAYS" && rhythm.anchor > today ? rhythm.anchor : today;
}

/** Each recurring income's paydays in a month (from its start on), with the income received for each, by date. */
export function expectedPaydays(definitions: RecurringIncomeDefinition[], incomes: ReceivedIncome[], month: MonthKey): ExpectedPayday[] {
  const received = new Map(
    incomes.flatMap((income) => (income.recurringIncomeId && income.expectedOn ? [[`${income.recurringIncomeId}:${dateKeyOf(income.expectedOn)}`, income] as const] : [])),
  );
  return definitions
    .flatMap((recurring) => paydaysInMonth(recurring.rhythm, month)
      .filter((date) => date >= recurring.startsOn)
      .map((date) => ({ recurring, date, received: received.get(`${recurring.id}:${date}`) ?? null })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.recurring.source.name.localeCompare(b.recurring.source.name));
}

/** Income still expected: the paydays not received yet, whether due already or still to come. */
export function expectedIncomeLeft(paydays: ExpectedPayday[]) {
  const left = paydays.filter((payday) => payday.received === null);
  return { cents: left.reduce((sum, payday) => sum + payday.recurring.amountCents, 0), paydaysLeft: left.length, paydays: paydays.length };
}
