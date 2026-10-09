import { monthKeyOf, type MonthKey } from "./months";

/** `currency` is its fund's. */
export type SavingsMovementRecord = { id: string; fundId: string; date: Date; amountCents: number; note: string | null; currency?: string };

export function fundBalance(movements: SavingsMovementRecord[], fundId: string) {
  return movements.filter((movement) => movement.fundId === fundId).reduce((sum, movement) => sum + movement.amountCents, 0);
}

/** Money moved into savings during a month (withdrawals subtract). It leaves spending money but is not spending. */
export function netSavingsInMonth(movements: SavingsMovementRecord[], month: MonthKey) {
  return movements.filter((movement) => monthKeyOf(movement.date) === month).reduce((sum, movement) => sum + movement.amountCents, 0);
}

/**
 * The spreadsheet's savings goal: an emergency fund covering `coverMonths` of average spending, plus the
 * installments still owed on cards ("MSI").
 */
export function emergencyFundGoal({ averageMonthlyCents, coverMonths, installmentsOwedCents, balanceCents }: {
  averageMonthlyCents: number;
  coverMonths: number;
  installmentsOwedCents: number;
  balanceCents: number;
}) {
  const emergencyCents = averageMonthlyCents * coverMonths;
  const goalCents = emergencyCents + installmentsOwedCents;
  return { emergencyCents, goalCents, pendingCents: Math.max(0, goalCents - balanceCents) };
}
