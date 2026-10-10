import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BalanceChart, type ChartBar } from "@/components/balance-chart";
import { ScrollToEnd } from "@/components/scroll-to-end";
import { StatsCard } from "@/components/summary-card";
import { isLocale, type Locale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/dates";
import { formatCents, formatWholeUnits } from "@/lib/money";
import type { MonthKey } from "@/lib/months";
import { loadYearView } from "@/lib/month-view";
import { getUserSettings } from "@/lib/queries";
import { currentMonthKey } from "@/lib/today";
import { buildYearGrid, type GridRow } from "@/lib/year-grid";
import { summarizeYear, yearCardStats, type YearBar } from "@/lib/year-summary";

const cellClass = "whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums";
const stickyClass = "sticky left-0 z-10 max-w-36 truncate border-r border-border px-3 py-2 text-left";

function monthName(month: MonthKey, locale: Locale, style: "short" | "narrow") {
  const label = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The calendar year asked for in the address ("?year=2026"), else the current one. */
function yearFromSearchParam(value: string | string[] | undefined, currentYear: number) {
  return typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : currentYear;
}

export default async function YearPage({ params, searchParams }: PageProps<"/[locale]/year">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();
  const year = yearFromSearchParam((await searchParams).year, Number(currentMonth.slice(0, 4)));

  const [{ months, categories, currency }, settings] = await Promise.all([loadYearView(userId, `${year}-12` as MonthKey), getUserSettings(userId)]);
  const grid = buildYearGrid(months, categories, { through: currentMonth });
  const summary = summarizeYear({ months, currentMonth, historyStart: settings.historyStartMonth, goalCents: settings.balanceGoalCents });
  const card = yearCardStats(summary, { messages, locale });
  const isCurrentYear = grid.monthKeys.includes(currentMonth);
  const goal = settings.balanceGoalCents === null ? null : formatCents(settings.balanceGoalCents, currency);
  const chartBars = summary.bars.map((bar): ChartBar => {
    const name = formatMonth(bar.month, locale);
    const note = barNote(bar);
    const amountText = bar.balanceCents === null ? null : formatCents(bar.balanceCents, currency);
    return {
      initial: monthName(bar.month, locale, "narrow"),
      name,
      cents: bar.balanceCents,
      note,
      description: [name, amountText, note?.text].filter(Boolean).join(", "),
    };
  });

  /** Under a month's amount: its progress toward the goal, or why it has no bar. */
  function barNote(bar: YearBar): ChartBar["note"] {
    if (bar.upcoming) return { text: messages.year.notStarted, tone: "muted" };
    if (bar.balanceCents === null) return { text: messages.year.beforeHistory, tone: "muted" };
    if (goal === null || bar.goalLeftCents === null) return null;
    if (bar.goalReached) return { text: format(messages.month.goalReached, { goal }), tone: "gain" };
    const left = formatCents(bar.goalLeftCents, currency);
    return bar.month === currentMonth
      ? { text: format(messages.month.goalToGo, { goal, amount: left }), tone: "muted" }
      : { text: format(messages.month.goalMissed, { goal, amount: left }), tone: "loss" };
  }

  /** An estimated amount (it includes an unconfirmed variable bill) is marked with "≈". */
  function amount(cents: number, className?: string, estimated = false) {
    if (cents === 0) return <span className="text-subtle">–</span>;
    return <span className={className}>{estimated ? "≈ " : null}{formatWholeUnits(cents, currency)}</span>;
  }

  /** The current month is tinted; months still to come show what's already scheduled, muted. */
  function columnClass(index: number) {
    const month = grid.monthKeys[index];
    return month === currentMonth ? "bg-primary/5" : month > currentMonth ? "opacity-50" : undefined;
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
        <Link aria-label={messages.year.previous} className={navClass} href={`/${locale}/year?year=${year - 1}`}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="text-center font-display text-lg font-semibold">{year}</h1>
        <Link aria-label={messages.year.next} className={navClass} href={`/${locale}/year?year=${year + 1}`}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <StatsCard grid={card.grid} headline={card.headline} messages={messages} />

      <BalanceChart
        bars={chartBars}
        goalCents={settings.balanceGoalCents}
        goalLabel={goal === null ? null : format(messages.year.goalLine, { goal })}
        // Starts on the current month, else the year's last month with a bar.
        selected={isCurrentYear ? grid.monthKeys.indexOf(currentMonth) : Math.max(0, chartBars.findLastIndex((bar) => bar.cents !== null))}
        title={messages.year.chartTitle}
      />

      <ScrollToEnd className="-mx-4 overflow-x-auto border-y border-border sm:mx-0 sm:rounded-2xl sm:border" target={isCurrentYear ? "[data-current]" : undefined}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className={cn(stickyClass, "bg-background font-medium")} scope="col">{messages.year.item}</th>
              {grid.monthKeys.map((month, index) => (
                <th
                  className={cn("whitespace-nowrap px-3 py-2 text-right font-medium", columnClass(index))}
                  data-current={month === currentMonth ? "" : undefined}
                  key={month}
                  scope="col"
                >
                  <Link className="hover:text-foreground" href={`/${locale}/month?m=${month}`}>{monthName(month, locale, "short")}</Link>
                </th>
              ))}
              <th className="border-l border-border px-3 py-2 text-right font-medium" scope="col">{isCurrentYear ? messages.year.toDate : messages.year.total}</th>
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
