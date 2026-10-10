import type { LedgerPurchase } from "./ledger";
import { monthKeyOf, type MonthKey } from "./months";
import type { RecurringOccurrence } from "./recurring";
import type { Statement } from "./statements";

/** Statement charge id for a recurring occurrence, unique per recurring payment and month. */
export function recurringChargeId(occurrence: Pick<RecurringOccurrence, "recurring" | "month">) {
  return `${occurrence.recurring.id}:${occurrence.month}`;
}

/** Cash occurrences are paid when marked; card occurrences are paid when the statement that includes them is paid. */
export function occurrencePaymentStatus(occurrence: RecurringOccurrence, statements: Statement[]) {
  if (occurrence.recurring.paymentMethod.kind === "CASH") return { paid: occurrence.cashPaidAt !== null, statement: null };
  const chargeId = recurringChargeId(occurrence);
  const statement = statements.find((item) => item.charges.some((charge) => charge.kind === "recurring" && charge.id === chargeId)) ?? null;
  return { paid: statement?.paid ?? false, statement };
}

/**
 * Cash leaving in a month ("total to pay") and what is still unpaid ("outstanding"). Card purchases and
 * card-paid recurring payments are counted only through their card statement, never twice. A statement
 * belongs to the month it closes, so it can be paid as soon as it is issued; its due date is shown with it.
 * Money moved into savings leaves spending money too, so it is part of the total to pay.
 *
 * With `carryFrom`, unpaid statements that closed from that month up to the previous month are carried into
 * this month separately, as are `carriedOccurrences` (unpaid cash bills from those months), so nothing unpaid
 * drops out of view when the month changes.
 */
export function monthCashFlow({ month, purchases, occurrences, statements, savingsNetCents = 0, carryFrom, carriedOccurrences = [] }: {
  month: MonthKey;
  purchases: LedgerPurchase[];
  occurrences: RecurringOccurrence[];
  statements: Statement[];
  savingsNetCents?: number;
  carryFrom?: MonthKey;
  carriedOccurrences?: RecurringOccurrence[];
}) {
  const cashPurchasesCents = purchases
    .filter((purchase) => purchase.paymentMethod.kind === "CASH" && monthKeyOf(purchase.date) === month)
    .reduce((sum, purchase) => sum + purchase.amountCents, 0);
  const cashOccurrences = occurrences.filter((occurrence) => occurrence.recurring.paymentMethod.kind === "CASH");
  // Listed in the order they close.
  const byClosingDate = (a: Statement, b: Statement) => a.closingDate.getTime() - b.closingDate.getTime();
  const statementsClosing = statements.filter((statement) => statement.month === month && statement.totalCents > 0).sort(byClosingDate);
  const carriedStatements = carryFrom
    ? statements.filter((statement) => !statement.paid && statement.totalCents > 0 && statement.month >= carryFrom && statement.month < month).sort(byClosingDate)
    : [];

  const unpaidOccurrences = cashOccurrences.filter((occurrence) => occurrence.cashPaidAt === null);
  const unpaidStatements = statementsClosing.filter((statement) => !statement.paid);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const cashBillsCents = sum(cashOccurrences.map((occurrence) => occurrence.amountCents));
  const statementsClosingCents = sum(statementsClosing.map((statement) => statement.totalCents));

  return {
    toPayCents: savingsNetCents + cashPurchasesCents + cashBillsCents + statementsClosingCents,
    /** The parts of the total to pay besides savings, for showing how it adds up. */
    cashPurchasesCents,
    cashBillsCents,
    statementsClosingCents,
    /** Unpaid items belonging to this month. */
    outstandingCents: sum(unpaidOccurrences.map((occurrence) => occurrence.amountCents)) + sum(unpaidStatements.map((statement) => statement.totalCents)),
    /** Unpaid statements and cash bills from earlier months, counted in their own month's totals and shown here as a reminder. */
    carriedOutstandingCents:
      sum(carriedStatements.map((statement) => statement.totalCents)) + sum(carriedOccurrences.map((occurrence) => occurrence.amountCents)),
    statementsClosing,
    carriedStatements,
    carriedOccurrences,
    unpaidOccurrences,
    unpaidStatements,
  };
}
