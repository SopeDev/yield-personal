import { splitInstallments } from "./installments";
import { addMonths, dateInMonth, daysInMonth, monthKeyOf, type MonthKey } from "./months";

/** A card closes on `closingDay` each month and is due `paymentDays` days later. */
export type BillingCycle = { closingDay: number; paymentDays: number };

export const DEFAULT_PAYMENT_DAYS = 15;
export const MAX_PAYMENT_DAYS = 60;

/** The month whose statement includes a charge made on `date`: charges after the closing day roll to the next statement. */
export function statementMonthOf(date: Date, closingDay: number): MonthKey {
  const month = monthKeyOf(date);
  return date.getUTCDate() <= Math.min(closingDay, daysInMonth(month)) ? month : addMonths(month, 1);
}

/** Closing and due dates of the statement that closes in `statementMonth`: due `paymentDays` after closing. */
export function statementDates(cycle: BillingCycle, statementMonth: MonthKey) {
  const closingDate = dateInMonth(statementMonth, cycle.closingDay);
  const dueDate = new Date(closingDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + cycle.paymentDays);
  return { closingDate, dueDate, dueMonth: monthKeyOf(dueDate) };
}

export type StatementCharge = {
  kind: "purchase" | "recurring";
  id: string;
  description: string;
  date: Date;
  amountCents: number;
  installmentNumber: number;
  installmentCount: number;
};

type CardPurchase = { id: string; description: string; date: Date; amountCents: number; installmentCount: number };
type CardRecurringCharge = { id: string; description: string; date: Date; amountCents: number };

/** Each installment lands on a consecutive statement, starting with the statement that includes the purchase date. */
export function purchaseStatementCharges(purchase: CardPurchase, closingDay: number) {
  const firstStatement = statementMonthOf(purchase.date, closingDay);
  return splitInstallments(purchase.amountCents, purchase.installmentCount).map((amountCents, index) => ({
    statementMonth: addMonths(firstStatement, index),
    charge: {
      kind: "purchase" as const,
      id: purchase.id,
      description: purchase.description,
      date: purchase.date,
      amountCents,
      installmentNumber: index + 1,
      installmentCount: purchase.installmentCount,
    },
  }));
}

export type Statement = {
  paymentMethodId: string;
  /** The card's currency (records made before currencies have none: the main one). */
  currency?: string;
  month: MonthKey;
  closingDate: Date;
  dueDate: Date;
  dueMonth: MonthKey;
  totalCents: number;
  charges: StatementCharge[];
  paid: boolean;
};

export function buildStatements(
  card: { id: string; currency?: string } & BillingCycle,
  purchases: CardPurchase[],
  recurringCharges: CardRecurringCharge[],
  paidMonths: Set<MonthKey>,
): Statement[] {
  const byMonth = new Map<MonthKey, StatementCharge[]>();
  const add = (month: MonthKey, charge: StatementCharge) => byMonth.set(month, [...(byMonth.get(month) ?? []), charge]);

  for (const purchase of purchases) {
    for (const { statementMonth, charge } of purchaseStatementCharges(purchase, card.closingDay)) add(statementMonth, charge);
  }
  for (const recurring of recurringCharges) {
    add(statementMonthOf(recurring.date, card.closingDay), { kind: "recurring", ...recurring, installmentNumber: 1, installmentCount: 1 });
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, charges]) => ({
      paymentMethodId: card.id,
      currency: card.currency,
      month,
      ...statementDates(card, month),
      totalCents: charges.reduce((sum, charge) => sum + charge.amountCents, 0),
      charges: charges.sort((a, b) => a.date.getTime() - b.date.getTime()),
      paid: paidMonths.has(month),
    }));
}

/** Installment ("MSI") amounts still owed: installment charges on statements not yet paid. */
export function installmentsOwed(statements: Statement[]) {
  return statements
    .filter((statement) => !statement.paid)
    .flatMap((statement) => statement.charges)
    .filter((charge) => charge.installmentCount > 1)
    .reduce((sum, charge) => sum + charge.amountCents, 0);
}
