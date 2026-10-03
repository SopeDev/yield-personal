import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { formatMonth } from "@/lib/dates";
import { addMonths, type MonthKey } from "@/lib/months";

export function MonthNav({ path, month, locale, labels }: {
  path: string;
  month: MonthKey;
  locale: Locale;
  labels: { previousMonth: string; nextMonth: string };
}) {
  const linkClass = "flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground";
  return (
    <div className="flex items-center justify-between">
      <Link aria-label={labels.previousMonth} className={linkClass} href={`${path}?m=${addMonths(month, -1)}`}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Link>
      <h1 className="font-display text-xl font-semibold">{formatMonth(month, locale)}</h1>
      <Link aria-label={labels.nextMonth} className={linkClass} href={`${path}?m=${addMonths(month, 1)}`}>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </div>
  );
}
