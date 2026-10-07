import { daysBetween } from "./dates";
import { daysInMonth, type MonthKey } from "./months";

export const INCOME_RHYTHM_KINDS = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTH_DAYS"] as const;
export type IncomeRhythmKind = (typeof INCOME_RHYTHM_KINDS)[number];

/** Most paydays a month-days rhythm may list. */
export const MAX_PAY_DAYS = 8;

/**
 * When income arrives: every day, weekly or every two weeks counted from any payday (`anchor`, "YYYY-MM-DD"), or on
 * fixed days of the month. Income is still recorded as it comes; the rhythm only sets the paydays stats count.
 */
export type IncomeRhythm =
  | { kind: "DAILY" }
  | { kind: "WEEKLY" | "BIWEEKLY"; anchor: string }
  | { kind: "MONTH_DAYS"; days: number[] };

export function isIncomeRhythmKind(value: string): value is IncomeRhythmKind {
  return (INCOME_RHYTHM_KINDS as readonly string[]).includes(value);
}

/** The rhythm as stored on the user; an incomplete one (no anchor or no days) counts as daily. */
export function incomeRhythmOf({ kind, anchor, days }: { kind: IncomeRhythmKind; anchor: string | null; days: number[] }): IncomeRhythm {
  if ((kind === "WEEKLY" || kind === "BIWEEKLY") && anchor) return { kind, anchor };
  if (kind === "MONTH_DAYS" && days.length > 0) return { kind, days };
  return { kind: "DAILY" };
}

/**
 * Reads days of the month typed like "14, 28" or "15 30": each 1–31, at most `MAX_PAY_DAYS`, returned sorted
 * without repeats. Null when nothing valid was typed.
 */
export function parsePayDays(input: string) {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  const days = parts.map(Number);
  if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) return null;
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > MAX_PAY_DAYS ? null : unique;
}

/** The month's paydays as "YYYY-MM-DD", in order. A day past the month's end falls on its last day. */
export function paydaysInMonth(rhythm: IncomeRhythm, month: MonthKey) {
  const lastDay = daysInMonth(month);
  const key = (day: number) => `${month}-${String(day).padStart(2, "0")}`;
  const allDays = Array.from({ length: lastDay }, (_, index) => index + 1);
  switch (rhythm.kind) {
    case "DAILY":
      return allDays.map(key);
    case "WEEKLY":
    case "BIWEEKLY": {
      const step = rhythm.kind === "WEEKLY" ? 7 : 14;
      return allDays.map(key).filter((day) => ((daysBetween(rhythm.anchor, day) % step) + step) % step === 0);
    }
    case "MONTH_DAYS":
      return [...new Set(rhythm.days.map((day) => Math.min(day, lastDay)))].sort((a, b) => a - b).map(key);
  }
}

/**
 * Income needed per payday left in the month (today's included) to cover its total to pay, plus the everyday
 * spending still to come (typical daily spending × days left), and `forGoalCents` to also reach the balance goal.
 * With a daily rhythm this is needed per day. With no paydays left, the whole shortfall shows. Null for a month
 * that has ended.
 */
export function neededPerPayday({ month, today, rhythm, toPayCents, incomeCents, goalProgressCents, goalCents = null, typicalDailyCents = 0 }: {
  month: MonthKey;
  /** Today as "YYYY-MM-DD". */
  today: string;
  rhythm: IncomeRhythm;
  toPayCents: number;
  incomeCents: number;
  /** The month's progress toward the balance goal (`goalProgress`). */
  goalProgressCents: number;
  goalCents?: number | null;
  typicalDailyCents?: number;
}) {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return null;
  const daysLeft = month === currentMonth ? daysInMonth(month) - Number(today.slice(8, 10)) + 1 : daysInMonth(month);
  const paydaysLeft = paydaysInMonth(rhythm, month).filter((day) => day >= today).length;
  const comingSpendingCents = typicalDailyCents * daysLeft;
  const perPayday = (shortfallCents: number) => Math.max(0, Math.ceil((shortfallCents + comingSpendingCents) / Math.max(1, paydaysLeft)));
  return {
    paydaysLeft,
    cents: perPayday(toPayCents - incomeCents),
    forGoalCents: goalCents === null ? null : perPayday(goalCents - goalProgressCents),
  };
}

/**
 * Average income per payday that has passed this month (today's included): gross, and net of everyday spending as
 * in daily net. Null before the month's first payday.
 */
export function incomePerPayday({ month, today, rhythm, incomeCents, everydaySpendingCents }: {
  month: MonthKey;
  today: string;
  rhythm: IncomeRhythm;
  /** Income on the days passed. */
  incomeCents: number;
  /** Everyday spending on the days passed. */
  everydaySpendingCents: number;
}) {
  const paydaysPassed = paydaysInMonth(rhythm, month).filter((day) => day <= today).length;
  if (paydaysPassed === 0) return null;
  return {
    paydaysPassed,
    grossCents: Math.round(incomeCents / paydaysPassed),
    netCents: Math.round((incomeCents - everydaySpendingCents) / paydaysPassed),
  };
}
