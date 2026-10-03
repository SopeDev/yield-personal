import { addMonths, monthDifference, monthKeyOf, type MonthKey } from "./months";

export const MAX_INSTALLMENTS = 48;

/** Splits an amount into equal installments; leftover centavos go to the earliest installments. */
export function splitInstallments(amountCents: number, count: number) {
  const base = Math.floor(amountCents / count);
  const remainder = amountCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

type InstallmentPurchase = { date: Date; amountCents: number; installmentCount: number };

/**
 * The portion of a purchase that counts toward consumption in a month: the full amount in its
 * purchase month, or one installment per month starting in the purchase month.
 */
export function consumptionInMonth(purchase: InstallmentPurchase, month: MonthKey) {
  const index = monthDifference(monthKeyOf(purchase.date), month);
  if (index < 0 || index >= purchase.installmentCount) return null;
  return {
    amountCents: splitInstallments(purchase.amountCents, purchase.installmentCount)[index],
    installmentNumber: index + 1,
  };
}

/** Earliest purchase month whose installments can still reach the given month. */
export function earliestContributingMonth(month: MonthKey) {
  return addMonths(month, -(MAX_INSTALLMENTS - 1));
}
