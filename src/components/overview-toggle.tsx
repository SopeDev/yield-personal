import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { MonthKey } from "@/lib/months";

/**
 * Switches the Overview between its month and year views, keeping your place: a month's view goes to its year,
 * and a year's goes to the same month of that year.
 */
export function OverviewToggle({ view, month, locale, labels }: {
  view: "month" | "year";
  /** The month shown, or for the year view, the month of that year to open. */
  month: MonthKey;
  locale: Locale;
  labels: { month: string; year: string };
}) {
  const tab = (active: boolean) => cn(
    "flex min-h-9 flex-1 items-center justify-center rounded-lg text-sm font-medium transition",
    active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  );
  return (
    <nav aria-label={`${labels.month} / ${labels.year}`} className="flex rounded-xl border border-border bg-background p-1">
      <Link aria-current={view === "month" ? "page" : undefined} className={tab(view === "month")} href={`/${locale}/month?m=${month}`}>{labels.month}</Link>
      <Link aria-current={view === "year" ? "page" : undefined} className={tab(view === "year")} href={`/${locale}/year?year=${month.slice(0, 4)}`}>{labels.year}</Link>
    </nav>
  );
}
