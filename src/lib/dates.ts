import type { Locale } from "@/i18n/config";
import { dateKeyOf, type MonthKey } from "./months";

export function formatMonth(month: MonthKey, locale: Locale) {
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Today", "Yesterday", or a short weekday and date. */
export function formatDayHeading(date: Date, todayKey: string, locale: Locale, labels: { today: string; yesterday: string }) {
  const key = dateKeyOf(date);
  if (key === todayKey) return labels.today;
  const yesterday = new Date(`${todayKey}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (key === dateKeyOf(yesterday)) return labels.yesterday;
  const label = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Groups items by calendar day, keeping their existing order. */
export function groupByDay<T>(items: T[], dateOf: (item: T) => Date) {
  const groups = new Map<string, { date: Date; items: T[] }>();
  for (const item of items) {
    const date = dateOf(item);
    const key = dateKeyOf(date);
    const group = groups.get(key) ?? { date, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Short date like "Nov 15" / "15 nov". */
export function formatShortDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** Whole days from one calendar date ("YYYY-MM-DD") to another; negative when `to` is earlier. */
export function daysBetween(fromKey: string, toKey: string) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${toKey}T00:00:00Z`).getTime() - new Date(`${fromKey}T00:00:00Z`).getTime()) / DAY_MS);
}
