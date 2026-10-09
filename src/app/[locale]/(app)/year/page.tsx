import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollToEnd } from "@/components/scroll-to-end";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/dates";
import { formatWholeUnits } from "@/lib/money";
import { addMonths, type MonthKey } from "@/lib/months";
import { loadYearView, YEAR_MONTHS } from "@/lib/month-view";
import { getMainCurrency } from "@/lib/queries";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey } from "@/lib/today";
import { buildYearGrid, type GridRow } from "@/lib/year-grid";

const cellClass = "whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums";
const stickyClass = "sticky left-0 z-10 max-w-36 truncate border-r border-border px-3 py-2 text-left";

function monthHeading(month: MonthKey, locale: Locale, showYear: boolean) {
  const date = new Date(`${month}-01T00:00:00Z`);
  const label = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date).replace(".", "");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), year: showYear ? month.slice(0, 4) : null };
}

export default async function YearPage({ params, searchParams }: PageProps<"/[locale]/year">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();
  const endMonth = monthFromSearchParam((await searchParams).end, currentMonth);

  const [{ months, categories }, currency] = await Promise.all([loadYearView(userId, endMonth), getMainCurrency(userId)]);
  const grid = buildYearGrid(months, categories);
  const startMonth = grid.monthKeys[0];

  /** An estimated amount (it includes an unconfirmed variable bill) is marked with "≈". */
  function amount(cents: number, className?: string, estimated = false) {
    if (cents === 0) return <span className="text-subtle">–</span>;
    return <span className={className}>{estimated ? "≈ " : null}{formatWholeUnits(cents, currency)}</span>;
  }

  function columnClass(index: number) {
    return grid.monthKeys[index] === currentMonth ? "bg-primary/5" : undefined;
  }

  function summaryRow(label: string, row: GridRow, options: { strong?: boolean; tone?: (cents: number) => string | undefined } = {}) {
    return (
      <tr className={options.strong ? "font-semibold" : undefined}>
        <th className={cn(stickyClass, "bg-background font-medium", options.strong && "font-semibold")} scope="row">{label}</th>
        {row.totalsCents.map((cents, index) => (
          <td className={cn(cellClass, columnClass(index))} key={grid.monthKeys[index]}>{amount(cents, options.tone?.(cents), row.estimated[index])}</td>
        ))}
        <td className={cn(cellClass, "border-l border-border")}>{amount(row.yearCents, options.tone?.(row.yearCents))}</td>
      </tr>
    );
  }

  const navClass = "flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link aria-label={messages.year.previous} className={navClass} href={`/${locale}/year?end=${addMonths(endMonth, -YEAR_MONTHS)}`}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="text-center font-display text-lg font-semibold">
          {formatMonth(startMonth, locale)} – {formatMonth(endMonth, locale)}
        </h1>
        <Link aria-label={messages.year.next} className={navClass} href={`/${locale}/year?end=${addMonths(endMonth, YEAR_MONTHS)}`}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <ScrollToEnd className="-mx-4 overflow-x-auto border-y border-border sm:mx-0 sm:rounded-2xl sm:border">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className={cn(stickyClass, "bg-background font-medium")} scope="col">{messages.year.item}</th>
              {grid.monthKeys.map((month, index) => {
                const heading = monthHeading(month, locale, index === 0 || month.endsWith("-01"));
                return (
                  <th className={cn("whitespace-nowrap px-3 py-2 text-right font-medium", columnClass(index))} key={month} scope="col">
                    <Link className="hover:text-foreground" href={`/${locale}/month?m=${month}`}>
                      {heading.label}
                      {heading.year ? <span className="block text-[10px] text-subtle">{heading.year}</span> : null}
                    </Link>
                  </th>
                );
              })}
              <th className="border-l border-border px-3 py-2 text-right font-medium" scope="col">{messages.year.total}</th>
            </tr>
          </thead>

          {grid.groups.map((group) => (
            <tbody key={group.category.id}>
              <tr className="bg-surface font-semibold">
                <th className={cn(stickyClass, "border-t bg-surface")} scope="rowgroup">{categoryLabel(group.category, messages.categories)}</th>
                {group.totalsCents.map((cents, index) => (
                  <td className={cn(cellClass, "border-t border-border", columnClass(index))} key={grid.monthKeys[index]}>{amount(cents, undefined, group.estimated[index])}</td>
                ))}
                <td className={cn(cellClass, "border-l border-t border-border")}>{amount(group.yearCents)}</td>
              </tr>
              {group.items.length === 0 ? (
                <tr>
                  <td className={cn(stickyClass, "bg-background text-subtle")}>{messages.year.noItems}</td>
                  <td colSpan={grid.monthKeys.length + 1} />
                </tr>
              ) : (
                group.items.map((row) => (
                  <tr key={row.item.id}>
                    <th className={cn(stickyClass, "bg-background pl-5 font-normal")} scope="row" title={row.item.name}>{row.item.name}</th>
                    {row.totalsCents.map((cents, index) => (
                      <td className={cn(cellClass, columnClass(index))} key={grid.monthKeys[index]}>
                        {cents === 0 ? amount(0) : (
                          <Link className="hover:text-primary" href={`/${locale}/month?m=${grid.monthKeys[index]}&item=${row.item.id}`}>{amount(cents, undefined, row.estimated[index])}</Link>
                        )}
                      </td>
                    ))}
                    <td className={cn(cellClass, "border-l border-border text-muted-foreground")}>{amount(row.yearCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          ))}

          <tbody className="[&>tr:first-child>*]:border-t-2 [&>tr:first-child>*]:border-border">
            {summaryRow(messages.year.spending, grid.spending, { strong: true })}
            {summaryRow(messages.year.toPay, grid.toPay)}
            {summaryRow(messages.year.outstanding, grid.outstanding, { tone: (cents) => (cents > 0 ? "text-warning" : undefined) })}
            {summaryRow(messages.year.income, grid.income, { tone: () => "text-gain" })}
            {summaryRow(messages.year.balance, grid.balance, { strong: true, tone: (cents) => (cents < 0 ? "text-loss" : "text-gain") })}
          </tbody>
        </table>
      </ScrollToEnd>
    </div>
  );
}
