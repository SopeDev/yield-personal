import { isEveryday } from "./categories";
import type { LedgerPurchase } from "./ledger";
import { addMonths, dateFromKey, dateKeyOf, monthKeyOf, type MonthKey } from "./months";
import type { RecurringOccurrence } from "./recurring";
import type { ExpectedPayday } from "./recurring-income";
import { statementDates, statementMonthOf, type BillingCycle, type Statement } from "./statements";

/** How far ahead the cash forecast looks. */
export const FORECAST_DAYS = 90;
/** Days near enough to forecast with some confidence; the line is drawn fainter after them. */
export const FORECAST_SURE_DAYS = 30;

/**
 * Money arriving (positive) or leaving (negative) cash on a day: a bill, a card statement, recurring income, a planned
 * move into savings, or a planned cash purchase.
 */
export type ForecastEvent = {
  /** "YYYY-MM-DD"; a bill, statement, or planned purchase already overdue falls on today. */
  date: string;
  kind: "bill" | "statement" | "income" | "savings" | "planned";
  label: string;
  cents: number;
  /** Partly or wholly estimated: a variable bill, or a statement still to be charged. */
  estimated: boolean;
  /** Due before today and not paid yet. */
  overdue: boolean;
  /** For a planned purchase on its own day, the part of it that's everyday spending: the day's typical spending covers that much of it. */
  everydayCents?: number;
};

export type ForecastDay = {
  date: string;
  cents: number;
  /** What leaves cash that day, as a positive amount: typical everyday cash spending plus its bills and statements. */
  spendingCents: number;
  events: ForecastEvent[];
};

/** "YYYY-MM-DD" `count` days after `dateKey`. */
export function addDays(dateKey: string, count: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKeyOf(date);
}

/**
 * Cash on hand day by day from today: today's cash, then each day the pace of income minus typical everyday cash
 * spending, plus the day's events. Today counts only the rest of an average day beyond what's already recorded,
 * as the month's projection does. Each day's figure is the cash at its end, alongside what left cash that day.
 */
export function forecastCash({ today, days = FORECAST_DAYS, startCents, paceDailyCents, cashDailyCents, todayIncomeCents = 0, todayCashSpentCents = 0, events }: {
  today: string;
  days?: number;
  startCents: number;
  paceDailyCents: number;
  cashDailyCents: number;
  todayIncomeCents?: number;
  todayCashSpentCents?: number;
  events: ForecastEvent[];
}) {
  const byDate = new Map<string, ForecastEvent[]>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  const dailyDrift = paceDailyCents - cashDailyCents;

  const result: ForecastDay[] = [];
  let cents = startCents;
  for (let index = 0; index <= days; index += 1) {
    const date = addDays(today, index);
    const dayEvents = (byDate.get(date) ?? []).sort((a, b) => a.cents - b.cents);
    // Everyday spending planned for the day is part of an average day: the day spends only what's left of one beyond
    // it (today, beyond what's already recorded too).
    const plannedEveryday = dayEvents.reduce((sum, event) => sum + (event.everydayCents ?? 0), 0);
    const typicalLeft = Math.max(0, cashDailyCents - plannedEveryday - (index === 0 ? todayCashSpentCents : 0));
    const incomeLeft = index === 0 ? Math.max(0, paceDailyCents - todayIncomeCents) : paceDailyCents;
    cents += incomeLeft - typicalLeft + dayEvents.reduce((sum, event) => sum + event.cents, 0);
    // Money moved into savings leaves cash but isn't spent.
    const spent = dayEvents.filter((event) => event.cents < 0 && event.kind !== "savings").reduce((sum, event) => sum + event.cents, 0);
    result.push({ date, cents, spendingCents: typicalLeft - spent, events: dayEvents });
  }
  return { days: result, dailyDriftCents: dailyDrift };
}

/**
 * Cash bills from `fromMonth` through the horizon still to pay: each on its due date, or today when already
 * overdue (from the month it was added on). Card bills are paid through their statements instead.
 */
export function billEvents(occurrences: RecurringOccurrence[], { today, end }: { today: string; end: string }): ForecastEvent[] {
  return occurrences
    .filter((occurrence) => occurrence.recurring.paymentMethod.kind === "CASH" && occurrence.cashPaidAt === null && occurrence.amountCents > 0)
    .filter((occurrence) => !occurrence.recurring.addedMonth || occurrence.month >= occurrence.recurring.addedMonth)
    .flatMap((occurrence) => {
      const due = dateKeyOf(occurrence.date);
      if (due > end) return [];
      return [{
        date: due < today ? today : due,
        kind: "bill" as const,
        label: occurrence.recurring.item.name,
        cents: -occurrence.amountCents,
        estimated: occurrence.estimated,
        overdue: due < today,
      }];
    });
}

/**
 * Cash purchases still planned, each on its date (today when its day has passed without being confirmed). One on its
 * own day carries its everyday part, which that day's typical spending covers.
 */
export function plannedPurchaseEvents(purchases: Pick<LedgerPurchase, "date" | "amountCents" | "item" | "paymentMethod" | "planned">[], { today, end }: { today: string; end: string }): ForecastEvent[] {
  return purchases
    .filter((purchase) => purchase.planned && purchase.paymentMethod.kind === "CASH")
    .flatMap((purchase) => {
      const day = dateKeyOf(purchase.date);
      if (day > end) return [];
      const overdue = day < today;
      return [{
        date: overdue ? today : day,
        kind: "planned" as const,
        label: purchase.item.name,
        cents: -purchase.amountCents,
        estimated: false,
        overdue,
        everydayCents: !overdue && isEveryday(purchase.item.category) ? purchase.amountCents : 0,
      }];
    });
}

/**
 * A card's statements due by the end of the horizon and not yet paid, each on its due date (today when overdue):
 * what's already charged to it (purchases, installments, recurring bills), plus, for a statement still open, the
 * card's typical everyday spending for each of its days still to come (today, only what's left of a typical day).
 * An archived card gets no new spending.
 */
export function cardStatementEvents({ today, end, card, statements }: {
  today: string;
  end: string;
  card: BillingCycle & { id: string; name: string; archived: boolean; dailyCents: number; todaySpentCents: number };
  /** The card's statements (others are ignored), including ones closing after today with installments or bills. */
  statements: Statement[];
}): ForecastEvent[] {
  const own = statements.filter((statement) => statement.paymentMethodId === card.id);
  const months = new Set<MonthKey>(own.filter((statement) => !statement.paid).map((statement) => statement.month));
  // Every statement month from the one open today through the horizon, even without charges yet.
  for (let month = statementMonthOf(dateFromKey(today), card.closingDay); dateKeyOf(statementDates(card, month).dueDate) <= end; month = addMonths(month, 1)) {
    months.add(month);
  }

  return [...months].sort().flatMap((month) => {
    const known = own.find((statement) => statement.month === month);
    if (known?.paid) return [];
    const { closingDate, dueDate } = statementDates(card, month);
    const closing = dateKeyOf(closingDate);
    const due = dateKeyOf(dueDate);
    if (due > end) return [];
    const cycleStart = addDays(dateKeyOf(statementDates(card, addMonths(month, -1)).closingDate), 1);
    let estimateCents = 0;
    if (!card.archived && closing >= today) {
      const firstDay = cycleStart > today ? cycleStart : addDays(today, 1);
      const futureDays = firstDay > closing ? 0 : daysFrom(firstDay, closing);
      const todayLeft = cycleStart <= today ? Math.max(0, card.dailyCents - card.todaySpentCents) : 0;
      estimateCents = futureDays * card.dailyCents + todayLeft;
    }
    const cents = (known?.totalCents ?? 0) + estimateCents;
    if (cents <= 0) return [];
    return [{ date: due < today ? today : due, kind: "statement" as const, label: card.name, cents: -cents, estimated: estimateCents > 0, overdue: due < today }];
  });
}

/** Recurring income not received yet: each payday on its date, or today when it's already past. */
export function paydayEvents(paydays: ExpectedPayday[], { today, end }: { today: string; end: string }): ForecastEvent[] {
  return paydays
    .filter((payday) => payday.received === null && payday.date <= end)
    .map((payday) => ({
      date: payday.date < today ? today : payday.date,
      kind: "income" as const,
      label: payday.recurring.source.name,
      cents: payday.recurring.amountCents,
      estimated: false,
      overdue: payday.date < today,
    }));
}

/** Days from `fromKey` through `toKey`, both included. */
function daysFrom(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The month a day key falls in. */
export function monthOfKey(dateKey: string) {
  return monthKeyOf(dateFromKey(dateKey));
}

/** Round steps for the amount axis: about five of them across the range, each 1, 2 or 5 times a power of ten. */
export function axisTicks(bottom: number, top: number) {
  const raw = (top - bottom) / 5 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let value = Math.ceil(bottom / step) * step; value <= top; value += step) ticks.push(value);
  return ticks;
}

/** "40k", "2.5k", "500", "−10k": an axis amount in whole units of the currency. */
export function compactAmount(cents: number) {
  const units = cents / 100;
  const sign = units < 0 ? "−" : "";
  const size = Math.abs(units);
  if (size < 1000) return `${sign}${Math.round(size)}`;
  const thousands = size / 1000;
  return `${sign}${Number.isInteger(thousands) ? thousands : thousands.toFixed(1).replace(/\.0$/, "")}k`;
}
