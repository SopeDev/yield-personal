import { format, type Messages } from "../i18n/dictionaries";
import { formatCents } from "./money";
import { dateKeyOf } from "./months";
import type { RecurringOccurrence } from "./recurring";
import type { Statement } from "./statements";

/** How many days ahead a payment counts as due soon (today plus the next 3). */
export const DUE_SOON_DAYS = 3;

export type DuePayment = {
  /** The bill's item name, or the card's name for a statement. */
  name: string;
  amountCents: number;
  currency: string | undefined;
  /** "YYYY-MM-DD" */
  dueOn: string;
  /** Days from today until it's due: 0 today, negative when overdue. */
  daysLeft: number;
};

/**
 * Payments still unpaid and due by `DUE_SOON_DAYS` from today, overdue ones included: cash recurring bills (card-paid
 * ones are paid through their statement) and card statements with charges. Soonest first.
 */
export function duePayments({ today, occurrences, statements, cardNames }: {
  /** "YYYY-MM-DD" */
  today: string;
  /** Recurring bills that may be due: this month's, next month's, and unpaid ones carried from earlier months. */
  occurrences: RecurringOccurrence[];
  statements: Statement[];
  cardNames: Map<string, string>;
}): DuePayment[] {
  const daysFromToday = (dueOn: string) => Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const bills = occurrences
    .filter((occurrence) => occurrence.recurring.paymentMethod.kind === "CASH" && occurrence.cashPaidAt === null && occurrence.amountCents > 0)
    .map((occurrence) => ({
      name: occurrence.recurring.item.name,
      amountCents: occurrence.amountCents,
      currency: occurrence.recurring.paymentMethod.currency,
      dueOn: dateKeyOf(occurrence.date),
    }));
  const cards = statements
    .filter((statement) => !statement.paid && statement.totalCents > 0)
    .map((statement) => ({
      name: cardNames.get(statement.paymentMethodId) ?? "",
      amountCents: statement.totalCents,
      currency: statement.currency,
      dueOn: dateKeyOf(statement.dueDate),
    }));
  return [...bills, ...cards]
    .map((payment) => ({ ...payment, daysLeft: daysFromToday(payment.dueOn) }))
    .filter((payment) => payment.daysLeft <= DUE_SOON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.amountCents - a.amountCents);
}

/**
 * The reminder for payments due soon: a title naming the payment, or how many there are, and a line per payment
 * with its amount and when it's due ("Renta · $11,900.00 · due in 2 days").
 */
export function dueReminder(payments: DuePayment[], { messages, mainCurrency }: { messages: Messages; mainCurrency: string }) {
  const m = messages.notifications;
  const when = ({ daysLeft }: DuePayment) => daysLeft === 0 ? m.dueToday
    : daysLeft === 1 ? m.dueTomorrow
      : daysLeft > 1 ? format(m.dueInDays, { count: daysLeft })
        : daysLeft === -1 ? m.overdueOne : format(m.overdueDays, { count: -daysLeft });
  const amount = (payment: DuePayment) => {
    const currency = payment.currency ?? mainCurrency;
    return formatCents(payment.amountCents, currency, currency !== mainCurrency);
  };
  const [first] = payments;
  return {
    title: payments.length === 1 ? format(m.dueOne, { name: first.name, when: when(first) }) : format(m.dueMany, { count: payments.length }),
    body: payments.map((payment) => `${payment.name} · ${amount(payment)} · ${when(payment)}`).join("\n"),
  };
}
