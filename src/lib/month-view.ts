import "server-only";

import { averageMonthlySpending } from "@/lib/averages";
import { TYPICAL_SPENDING_MONTHS } from "@/lib/daily-balance";
import { getSavingsFunds, loadCashOnHand, loadLedgerRange } from "@/lib/ledger-data";
import { getUserSettings } from "@/lib/queries";
import { cardLayout, monthStatContext, type SummaryCardId } from "@/lib/stats";
import { summarizeMonth, type MonthSummary } from "@/lib/month-summary";
import { addMonths, type MonthKey } from "@/lib/months";
import { emergencyFundGoal, fundBalance } from "@/lib/savings";
import { installmentsOwed } from "@/lib/statements";

/** The year view and averages cover the last 12 months, ending with the given month. */
export const YEAR_MONTHS = 12;

/** How far back unpaid card statements and cash bills are carried into the current month. */
export const CARRY_UNPAID_MONTHS = 12;

/**
 * The current month also carries unpaid statements and cash bills from earlier months; other months show only
 * their own. Recent purchases are loaded too, for typical daily spending (needed per day).
 */
export async function loadMonthView(userId: string, month: MonthKey, currentMonth: MonthKey) {
  const carryFrom = month === currentMonth ? addMonths(month, -CARRY_UNPAID_MONTHS) : undefined;
  const { data, cards } = await loadLedgerRange(userId, month, month, {
    statementsFrom: carryFrom,
    purchasesFrom: addMonths(currentMonth, -TYPICAL_SPENDING_MONTHS),
  });
  return { ...summarizeMonth(data, month, { carryFrom }), cards, statements: data.statements, purchases: data.purchases };
}

/**
 * A summary card's layout (customized or default) and the figures it is calculated from. Money on hand takes its
 * own queries, so it is loaded only when the customized card shows it.
 */
export async function loadSummaryCard(userId: string, card: SummaryCardId, { view, today, settings }: {
  view: Awaited<ReturnType<typeof loadMonthView>>;
  today: string;
  settings: Awaited<ReturnType<typeof getUserSettings>>;
}) {
  const stored = settings.summaryCards[card];
  const showsCash = stored !== undefined && [stored.headline, ...stored.grid].includes("cashOnHand");
  const context = monthStatContext({ view, today, settings, cashOnHandCents: showsCash ? await loadCashOnHand(userId) : null });
  return { context, layout: cardLayout(card, settings.summaryCards, context) };
}

/** Average monthly spending over the given months, skipping those before `historyStart` (they may hold only partial records). */
function averageSince(months: MonthSummary[], historyStart: MonthKey | null) {
  return averageMonthlySpending(
    months.filter((month) => !historyStart || month.month >= historyStart).map((month) => ({ month: month.month, byCategory: month.spending.byCategory })),
  );
}

export async function loadYearView(userId: string, endMonth: MonthKey) {
  const startMonth = addMonths(endMonth, -(YEAR_MONTHS - 1));
  const { data } = await loadLedgerRange(userId, startMonth, endMonth);
  const months = Array.from({ length: YEAR_MONTHS }, (_, index) => summarizeMonth(data, addMonths(startMonth, index)));
  return { data, categories: data.categories, months };
}

/** Savings funds with balances, and the emergency fund goal from average spending and installments owed. */
export async function loadSavingsView(userId: string, currentMonth: MonthKey) {
  const [{ data, months }, funds, { historyStartMonth }] = await Promise.all([loadYearView(userId, currentMonth), getSavingsFunds(userId), getUserSettings(userId)]);
  const average = averageSince(months, historyStartMonth);
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
