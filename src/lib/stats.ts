import { format, type Messages } from "../i18n/dictionaries";
import { categoryLabel } from "./categories";
import { dailyNet, goalProgress, neededPerDay, typicalDailySpending } from "./daily-balance";
import { incomePerPayday, neededPerPayday, type IncomeRhythm } from "./income-rhythm";
import type { LedgerPurchase } from "./ledger";
import { DEFAULT_CURRENCY, formatCents, type Currency } from "./money";
import type { MonthSummary } from "./month-summary";
import type { MonthKey } from "./months";

/**
 * The stat library: every summary figure as a label, a calculation, and how it reads (tone and a note below the
 * amount). Summary cards are layouts of stat references, so the same figure reads the same on any card.
 */

export type StatTone = "gain" | "loss" | "warning" | "muted";
export type StatNote = { text: string; tone: StatTone };
/** A figure ready to show, or null when it has no value this month (shown as "–"). */
export type StatValue = { cents: number; tone?: StatTone; note?: StatNote } | null;

/** Settings that shape month figures; the income rhythm defaults to daily. */
export type StatSettings = { balanceGoalCents: number | null; historyStartMonth: MonthKey | null; incomeRhythm?: IncomeRhythm; currency?: Currency };

/** A month's figures from which every stat is calculated, plus money on hand, which is the same in every month. */
export function monthStatContext({ view, today, settings, cashOnHandCents = null, incomeGroups = [] }: {
  view: Pick<MonthSummary, "month" | "entries" | "incomes" | "income" | "spending" | "cashFlow" | "savingsNetCents" | "balanceCents"> & {
    purchases: LedgerPurchase[];
  };
  /** Today as "YYYY-MM-DD". */
  today: string;
  settings: StatSettings;
  /** Money on hand now (`loadCashOnHand`), or null when it isn't set or loaded. */
  cashOnHandCents?: number | null;
  /** Income groups to name in group stats even in a month without their income, as the card editor lists them. */
  incomeGroups?: { id: string; name: string }[];
}) {
  const { month, entries, incomes, income, cashFlow, savingsNetCents, balanceCents } = view;
  const goalCents = settings.balanceGoalCents;
  const rhythm = settings.incomeRhythm ?? { kind: "DAILY" };
  const dayNet = dailyNet({ month, today, entries, incomes });
  const typicalDay = typicalDailySpending({ purchases: view.purchases, today, historyStart: settings.historyStartMonth });
  const needed = neededPerDay({
    month, today, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents, savingsNetCents, goalCents, typicalDailyCents: typicalDay.cents,
  });
  const goalProgressCents = goalProgress({ balanceCents, savingsNetCents });
  return {
    ...view,
    currency: settings.currency ?? DEFAULT_CURRENCY,
    cashOnHandCents,
    incomeGroups,
    goalCents,
    rhythm,
    dayNet,
    needed,
    neededPayday: neededPerPayday({
      month, today, rhythm, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents, goalProgressCents, goalCents, typicalDailyCents: typicalDay.cents,
    }),
    paydayIncome: dayNet ? incomePerPayday({ month, today, rhythm, incomeCents: dayNet.incomeCents, everydaySpendingCents: dayNet.spendingCents }) : null,
    // The day's target is the goal's when one is set; average daily income is gross, like the target.
    targetCents: needed ? (needed.forGoalCents ?? needed.cents) : null,
    dailyIncomeCents: dayNet ? Math.round(dayNet.incomeCents / dayNet.days) : null,
    // Money moved into savings counts toward the goal.
    goalLeftCents: goalCents === null ? 0 : goalCents - goalProgressCents,
  };
}

export type StatContext = ReturnType<typeof monthStatContext>;

type StatDefinition = {
  label: (context: StatContext, messages: Messages, param: string) => string;
  /** Whether the stat appears this month at all; a hidden stat leaves no cell behind. Shown by default. */
  shown?: (context: StatContext, param: string) => boolean;
  value: (context: StatContext, messages: Messages, param: string) => StatValue;
};

const signTone = (cents: number): StatTone => (cents < 0 ? "loss" : "gain");
const zeroIsGain = (cents: number): StatTone | undefined => (cents === 0 ? "gain" : undefined);
const groupOf = (context: StatContext, groupId: string) => context.income.byGroup.find((entry) => entry.group.id === groupId);
const groupName = (context: StatContext, groupId: string) =>
  groupOf(context, groupId)?.group.name ?? context.incomeGroups.find((group) => group.id === groupId)?.name ?? "";
const notDaily = (context: StatContext) => context.rhythm.kind !== "DAILY";
const hasDeductions = (context: StatContext) => context.income.deductCategoryIds.length > 0;
// A group's figures differ from the totals only when there is income outside it too.
const groupShown = (context: StatContext, groupId: string) => {
  const group = groupOf(context, groupId);
  return group !== undefined && group.grossCents < context.income.totalCents;
};

const STATS = {
  /** As in the spreadsheet: income minus everything paid out this month, with progress toward the balance goal. */
  balance: {
    label: (_, messages) => messages.month.balance,
    value: ({ balanceCents, goalCents, goalLeftCents, needed, currency }, messages) => {
      const goal = goalCents === null ? null : formatCents(goalCents, currency);
      // A month that has ended either met the goal or missed it.
      const note: StatNote | undefined = goal === null ? undefined
        : goalLeftCents <= 0 ? { text: format(messages.month.goalReached, { goal }), tone: "gain" }
          : needed ? { text: format(messages.month.goalToGo, { goal, amount: formatCents(goalLeftCents, currency) }), tone: "muted" }
            : { text: format(messages.month.goalMissed, { goal, amount: formatCents(goalLeftCents, currency) }), tone: "loss" };
      return { cents: balanceCents, tone: signTone(balanceCents), note };
    },
  },
  income: {
    label: (_, messages) => messages.month.income,
    value: ({ income }) => ({ cents: income.totalCents }),
  },
  /** Total income, with the number of days that had any. */
  totalIncome: {
    label: (_, messages) => messages.income.total,
    value: ({ income }, messages) => ({
      cents: income.totalCents,
      tone: "gain",
      note: income.daysWithIncome === 0 ? undefined : {
        text: income.daysWithIncome === 1 ? messages.income.daysWithIncomeOne : format(messages.income.daysWithIncome, { count: income.daysWithIncome }),
        tone: "muted",
      },
    }),
  },
  spending: {
    label: (_, messages) => messages.month.spending,
    value: ({ spending }) => ({ cents: spending.totalCents }),
  },
  toPay: {
    label: (_, messages) => messages.month.toPay,
    value: ({ cashFlow }) => ({ cents: cashFlow.toPayCents }),
  },
  /** Unpaid bills and statements, noting what was carried from earlier months. */
  outstanding: {
    label: (_, messages) => messages.month.outstanding,
    value: ({ cashFlow, currency }, messages) => ({
      cents: cashFlow.outstandingCents,
      tone: cashFlow.outstandingCents > 0 ? "warning" : undefined,
      note: cashFlow.carriedOutstandingCents > 0
        ? { text: format(messages.month.includesCarried, { amount: formatCents(cashFlow.carriedOutstandingCents, currency) }), tone: "loss" }
        : undefined,
    }),
  },
  /** Income needed per remaining day; with a goal, the goal's daily target leads and breaking even is noted below. */
  neededPerDay: {
    label: (_, messages) => messages.month.neededPerDay,
    value: ({ needed, currency }, messages) => {
      if (!needed) return null;
      if (needed.forGoalCents !== null) {
        return { cents: needed.forGoalCents, tone: zeroIsGain(needed.forGoalCents), note: { text: format(messages.month.breakEven, { amount: formatCents(needed.cents, currency) }), tone: "muted" } };
      }
      return {
        cents: needed.cents,
        tone: zeroIsGain(needed.cents),
        note: needed.typicalDailyCents > 0 ? { text: format(messages.month.inclEveryday, { amount: formatCents(needed.typicalDailyCents, currency) }), tone: "muted" } : undefined,
      };
    },
  },
  /** Gross income per day passed, against the day's target, with daily net below. */
  dailyIncome: {
    label: (_, messages) => messages.month.dailyIncome,
    value: ({ dayNet, dailyIncomeCents, targetCents, currency }, messages) => {
      if (!dayNet || dailyIncomeCents === null) return null;
      return {
        cents: dailyIncomeCents,
        tone: targetCents === null ? undefined : dailyIncomeCents >= targetCents ? "gain" : "warning",
        note: { text: format(messages.month.netPerDay, { amount: formatCents(dayNet.averageCents, currency) }), tone: "muted" },
      };
    },
  },
  /**
   * Income needed per payday left, following the income rhythm (hidden with a daily rhythm, where it is needed per
   * day); with a goal, the goal's target leads and breaking even is noted below.
   */
  neededPerPayday: {
    label: (_, messages) => messages.month.neededPerPayday,
    shown: notDaily,
    value: ({ neededPayday, currency }, messages) => {
      if (!neededPayday) return null;
      const { paydaysLeft } = neededPayday;
      const left: StatNote = paydaysLeft === 0 ? { text: messages.month.noPaydaysLeft, tone: "warning" }
        : { text: paydaysLeft === 1 ? messages.month.paydaysLeftOne : format(messages.month.paydaysLeft, { count: paydaysLeft }), tone: "muted" };
      if (neededPayday.forGoalCents !== null) {
        return {
          cents: neededPayday.forGoalCents,
          tone: zeroIsGain(neededPayday.forGoalCents),
          note: paydaysLeft === 0 ? left : { text: format(messages.month.breakEven, { amount: formatCents(neededPayday.cents, currency) }), tone: "muted" },
        };
      }
      return { cents: neededPayday.cents, tone: zeroIsGain(neededPayday.cents), note: left };
    },
  },
  /** Gross income per payday passed, against the payday target, with net below (hidden with a daily rhythm). */
  incomePerPayday: {
    label: (_, messages) => messages.month.incomePerPayday,
    shown: notDaily,
    value: ({ paydayIncome, neededPayday, currency }, messages) => {
      if (!paydayIncome) return null;
      const targetCents = neededPayday ? (neededPayday.forGoalCents ?? neededPayday.cents) : null;
      return {
        cents: paydayIncome.grossCents,
        tone: targetCents === null ? undefined : paydayIncome.grossCents >= targetCents ? "gain" : "warning",
        note: { text: format(messages.month.netPerDay, { amount: formatCents(paydayIncome.netCents, currency) }), tone: "muted" },
      };
    },
  },
  /** Spending in the categories income groups deduct; a single category is named ("Car spending"). */
  deductions: {
    label: ({ income, spending }, messages) => {
      const categories = income.deductCategoryIds.map((id) => spending.byCategory.find((entry) => entry.category.id === id)?.category).filter((category) => category !== undefined);
      return categories.length === 1 ? format(messages.income.categorySpending, { category: categoryLabel(categories[0], messages.categories) }) : messages.income.deductions;
    },
    shown: hasDeductions,
    value: ({ income }) => ({ cents: -income.deductionsCents, tone: "muted" }),
  },
  netIncome: {
    label: (_, messages) => messages.income.net,
    shown: hasDeductions,
    value: ({ income }) => ({ cents: income.netCents, tone: signTone(income.netCents) }),
  },
  /** Gross income per day with income recorded. */
  incomeDayGross: {
    label: (_, messages) => messages.income.dailyGross,
    value: ({ income }) => ({ cents: income.dailyGrossCents }),
  },
  /** Net income per day with income recorded. */
  incomeDayNet: {
    label: (_, messages) => messages.income.dailyNet,
    value: ({ income }) => ({ cents: income.dailyNetCents, tone: signTone(income.dailyNetCents) }),
  },
  /** Money on hand right now (cash, debit, and app balances outside savings), whatever the month; none until set in Settings. */
  cashOnHand: {
    label: (_, messages) => messages.month.cashOnHand,
    value: ({ cashOnHandCents }) => (cashOnHandCents === null ? null : { cents: cashOnHandCents, tone: signTone(cashOnHandCents) }),
  },
  /** An income group's gross; the parameter is the group's id. */
  groupGross: {
    label: (context, messages, groupId) => format(messages.income.groupGross, { group: groupName(context, groupId) }),
    shown: groupShown,
    value: (context, _, groupId) => ({ cents: groupOf(context, groupId)?.grossCents ?? 0 }),
  },
  /** An income group's net after the categories it deducts; the parameter is the group's id. */
  groupNet: {
    label: (context, messages, groupId) => format(messages.income.groupNet, { group: groupName(context, groupId) }),
    shown: groupShown,
    value: (context, _, groupId) => {
      const netCents = groupOf(context, groupId)?.netCents ?? 0;
      return { cents: netCents, tone: signTone(netCents) };
    },
  },
} satisfies Record<string, StatDefinition>;

export type StatId = keyof typeof STATS;
type ParamStatId = "groupGross" | "groupNet";
/** A stat on a card: its id, or "id:param" for a stat about one thing, like "groupNet:<group id>". */
export type StatRef = Exclude<StatId, ParamStatId> | `${ParamStatId}:${string}`;

export type ResolvedStat = { ref: StatRef; label: string; value: StatValue };

/** A reference's stat definition and parameter, or null for an unknown stat. */
function statOf(ref: string) {
  const colon = ref.indexOf(":");
  const [id, param] = colon === -1 ? [ref, ""] : [ref.slice(0, colon), ref.slice(colon + 1)];
  return Object.hasOwn(STATS, id) ? { stat: STATS[id as StatId] as StatDefinition, param } : null;
}

/** The stats to show, in order, leaving out those hidden this month and any unknown reference. */
export function resolveStats(refs: StatRef[], context: StatContext, messages: Messages): ResolvedStat[] {
  return refs.flatMap((ref) => {
    const found = statOf(ref);
    if (!found) return [];
    const { stat, param } = found;
    if (stat.shown && !stat.shown(context, param)) return [];
    return [{ ref, label: stat.label(context, messages, param), value: stat.value(context, messages, param) }];
  });
}

/** A summary card: a headline figure above a two-column grid of stats. */
export type SummaryCardLayout = { headline: StatRef; grid: StatRef[] };

export const SUMMARY_CARD_IDS = ["month", "income"] as const;
export type SummaryCardId = (typeof SUMMARY_CARD_IDS)[number];
/** Customized cards as stored on the user; a card left out keeps its default. */
export type SummaryCards = Partial<Record<SummaryCardId, SummaryCardLayout>>;

/** Most stats a card's grid may hold. */
export const MAX_GRID_STATS = 12;

export function isSummaryCardId(value: string): value is SummaryCardId {
  return (SUMMARY_CARD_IDS as readonly string[]).includes(value);
}

const PARAM_STATS: readonly string[] = ["groupGross", "groupNet"] satisfies ParamStatId[];

/** Whether a string names a stat: a plain id, or a parameterized id with its parameter. */
export function isStatRef(value: string): value is StatRef {
  const colon = value.indexOf(":");
  const id = colon === -1 ? value : value.slice(0, colon);
  if (!Object.hasOwn(STATS, id)) return false;
  return PARAM_STATS.includes(id) ? colon > 0 && value.length > colon + 1 : colon === -1;
}

/** Stored customized cards, keeping only well-formed layouts and known stats. */
export function parseSummaryCards(stored: unknown): SummaryCards {
  if (!stored || typeof stored !== "object") return {};
  const cards: SummaryCards = {};
  for (const card of SUMMARY_CARD_IDS) {
    const layout = (stored as Record<string, unknown>)[card];
    if (!layout || typeof layout !== "object") continue;
    const { headline, grid } = layout as { headline?: unknown; grid?: unknown };
    if (typeof headline !== "string" || !isStatRef(headline) || !Array.isArray(grid)) continue;
    cards[card] = { headline, grid: grid.filter((ref): ref is StatRef => typeof ref === "string" && isStatRef(ref)).slice(0, MAX_GRID_STATS) };
  }
  return cards;
}

/**
 * The month card by default: balance, then income and outstanding, spending and to pay, and the daily pair (needed
 * per day and daily income), or the per-payday pair when income comes on paydays.
 */
function monthCard(context: StatContext): SummaryCardLayout {
  const rates: StatRef[] = context.rhythm.kind === "DAILY" ? ["neededPerDay", "dailyIncome"] : ["neededPerPayday", "incomePerPayday"];
  return { headline: "balance", grid: ["income", "outstanding", "spending", "toPay", ...rates] };
}

/** The income card by default, followed by a gross and net pair for each income group that had income. */
function incomeCard(context: StatContext): SummaryCardLayout {
  return {
    headline: "totalIncome",
    grid: [
      "deductions", "netIncome", "incomeDayGross", "incomeDayNet",
      ...context.income.byGroup.flatMap(({ group }) => [`groupGross:${group.id}`, `groupNet:${group.id}`] as const),
    ],
  };
}

export function defaultCardLayout(card: SummaryCardId, context: StatContext) {
  return card === "month" ? monthCard(context) : incomeCard(context);
}

/** A card's layout: the user's customized one, else the default. */
export function cardLayout(card: SummaryCardId, cards: SummaryCards, context: StatContext) {
  return cards[card] ?? defaultCardLayout(card, context);
}

/** Every stat a card may show, in library order, with a gross and net pair for each of the given income groups. */
export function availableStats(context: StatContext, groups: { id: string }[]): StatRef[] {
  return (Object.keys(STATS) as StatId[]).flatMap((id): StatRef[] => {
    if (id === "groupGross" || id === "groupNet") return groups.map((group) => `${id}:${group.id}` as const);
    if ((id === "neededPerPayday" || id === "incomePerPayday") && !notDaily(context)) return [];
    return [id];
  });
}

/** Whether a stat shows this month; the card editor marks the ones that don't. */
export function statShown(ref: StatRef, context: StatContext) {
  const found = statOf(ref);
  return found !== null && (found.stat.shown?.(context, found.param) ?? true);
}

/** A stat's label, whether or not it shows this month, for listing it in the card editor. */
export function statLabel(ref: StatRef, context: StatContext, messages: Messages) {
  const found = statOf(ref);
  return found ? found.stat.label(context, messages, found.param) : ref;
}
