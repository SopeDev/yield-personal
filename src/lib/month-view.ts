import "server-only";

import { averageMonthlySpending } from "@/lib/averages";
import { getSavingsFunds, loadLedgerRange } from "@/lib/ledger-data";
import { summarizeMonth } from "@/lib/month-summary";
import { addMonths, type MonthKey } from "@/lib/months";
import { emergencyFundGoal, fundBalance } from "@/lib/savings";
import { installmentsOwed } from "@/lib/statements";

/** The year view and averages cover the last 12 months, ending with the given month. */
export const YEAR_MONTHS = 12;

/** How far back unpaid card statements and cash bills are carried into the current month. */
const CARRY_UNPAID_MONTHS = 12;

/** The current month also carries unpaid statements and cash bills from earlier months; other months show only their own. */
export async function loadMonthView(userId: string, month: MonthKey, currentMonth: MonthKey) {
  const carryFrom = month === currentMonth ? addMonths(month, -CARRY_UNPAID_MONTHS) : undefined;
  const { data, cards } = await loadLedgerRange(userId, month, month, { statementsFrom: carryFrom });
  return { ...summarizeMonth(data, month, { carryFrom }), cards, statements: data.statements };
}

export async function loadYearView(userId: string, endMonth: MonthKey) {
  const startMonth = addMonths(endMonth, -(YEAR_MONTHS - 1));
  const { data } = await loadLedgerRange(userId, startMonth, endMonth);
  const months = Array.from({ length: YEAR_MONTHS }, (_, index) => summarizeMonth(data, addMonths(startMonth, index)));
  return {
    data,
    categories: data.categories,
    months,
    average: averageMonthlySpending(months.map((month) => ({ month: month.month, byCategory: month.spending.byCategory }))),
  };
}

/** Savings funds with balances, and the emergency fund goal from average spending and installments owed. */
export async function loadSavingsView(userId: string, currentMonth: MonthKey) {
  const [{ data, months, average }, funds] = await Promise.all([loadYearView(userId, currentMonth), getSavingsFunds(userId)]);
  const installmentsOwedCents = installmentsOwed(data.statements);

  return {
    average,
    months,
    installmentsOwedCents,
    movements: data.savingsMovements,
    funds: funds.map((fund) => {
      const balanceCents = fundBalance(data.savingsMovements, fund.id);
      const goal = fund.kind === "EMERGENCY"
        ? emergencyFundGoal({ averageMonthlyCents: average.totalCents, coverMonths: fund.coverMonths, installmentsOwedCents, balanceCents })
        : { emergencyCents: 0, goalCents: fund.targetCents ?? 0, pendingCents: Math.max(0, (fund.targetCents ?? 0) - balanceCents) };
      return { ...fund, balanceCents, ...goal };
    }),
  };
}
