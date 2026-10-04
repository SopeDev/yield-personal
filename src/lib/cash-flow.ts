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
 * card-paid recurring payments are counted only through the statement due that month, never twice.
 * Money moved into savings leaves spending money too, so it is part of the total to pay.
 */
export function monthCashFlow({ month, purchases, occurrences, statements, savingsNetCents = 0 }: {
  month: MonthKey;
  purchases: LedgerPurchase[];
  occurrences: RecurringOccurrence[];
  statements: Statement[];
  savingsNetCents?: number;
}) {
  const cashPurchasesCents = purchases
    .filter((purchase) => purchase.paymentMethod.kind === "CASH" && monthKeyOf(purchase.date) === month)
    .reduce((sum, purchase) => sum + purchase.amountCents, 0);
  const cashOccurrences = occurrences.filter((occurrence) => occurrence.recurring.paymentMethod.kind === "CASH");
  const statementsDue = statements.filter((statement) => statement.dueMonth === month && statement.totalCents > 0);

  const unpaidOccurrences = cashOccurrences.filter((occurrence) => occurrence.cashPaidAt === null);
  const unpaidStatements = statementsDue.filter((statement) => !statement.paid);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  return {
    toPayCents:
      savingsNetCents +
      cashPurchasesCents + sum(cashOccurrences.map((occurrence) => occurrence.amountCents)) + sum(statementsDue.map((statement) => statement.totalCents)),
    outstandingCents: sum(unpaidOccurrences.map((occurrence) => occurrence.amountCents)) + sum(unpaidStatements.map((statement) => statement.totalCents)),
    statementsDue,
    unpaidOccurrences,
    unpaidStatements,
  };
}
