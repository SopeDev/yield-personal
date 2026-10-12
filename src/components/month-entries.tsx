"use client";

import { Search, X } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { entryMatches, filteredTotals, type EntryFilter, type FilterableEntry } from "@/lib/entry-filter";
import { Money } from "./money";
import { Card, Section } from "./section";

export type EntryItem = FilterableEntry & { key: string; row: ReactNode };
export type EntryDay = { key: string; heading: string; items: EntryItem[] };

/**
 * The month's spending by category and its entries, with a search box above the entries. Tapping a category, or
 * typing (an item, source, payment method, or note), narrows the entries to those that match, with how many there
 * are and what they add up to; tapping the category again, or clearing the search, shows them all.
 */
export function MonthEntries({ categories, days, installments, empty, mainCurrency, labels }: {
  categories: { id: string; label: string; totalCents: number }[];
  days: EntryDay[];
  /** Installments of purchases made in earlier months, listed apart from this month's days. */
  installments: EntryItem[];
  /** Shown instead of the entries when the month has none at all. */
  empty: ReactNode;
  mainCurrency: string;
  labels: {
    byCategory: string; entries: string; installments: string; search: string; clear: string;
    results: string; resultsOne: string; spent: string; received: string; noMatches: string;
  };
}) {
  const [filter, setFilter] = useState<EntryFilter>({ query: "", categoryId: null });
  const filtering = filter.query.trim() !== "" || filter.categoryId !== null;
  const visibleDays = days
    .map((day) => ({ ...day, items: day.items.filter((item) => entryMatches(item, filter)) }))
    .filter((day) => day.items.length > 0);
  const visibleInstallments = installments.filter((item) => entryMatches(item, filter));
  const matches = [...visibleDays.flatMap((day) => day.items), ...visibleInstallments];
  const totals = filteredTotals(matches, mainCurrency);
  const hasEntries = days.length > 0 || installments.length > 0;
  const toggleCategory = (id: string) => setFilter((current) => ({ ...current, categoryId: current.categoryId === id ? null : id }));

  return (
    <>
      <Section title={labels.byCategory}>
        <Card>
          <ul className="divide-y divide-border">
            {categories.map(({ id, label, totalCents }) => (
              <li key={id}>
                <button
                  aria-pressed={filter.categoryId === id}
                  className={cn("flex min-h-12 w-full items-center justify-between px-4 py-3 text-left transition hover:bg-background/60", filter.categoryId === id && "bg-primary/10")}
                  onClick={() => toggleCategory(id)}
                  type="button"
                >
                  <span className={cn(filter.categoryId === id && "font-semibold text-primary")}>{label}</span>
                  <Money cents={totalCents} className={totalCents === 0 ? "text-subtle" : undefined} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title={labels.entries}>
        {!hasEntries ? empty : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <input
                  className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-subtle"
                  enterKeyHint="search"
                  onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
                  placeholder={labels.search}
                  type="search"
                  value={filter.query}
                />
                {filtering ? (
                  <button aria-label={labels.clear} className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" onClick={() => setFilter({ query: "", categoryId: null })} type="button">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </label>
              {filtering ? (
                <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-2 px-1 text-sm text-muted-foreground">
                  {[
                    filter.categoryId ? categories.find((category) => category.id === filter.categoryId)?.label : null,
                    (totals.count === 1 ? labels.resultsOne : labels.results).replace("{count}", String(totals.count)),
                  ].filter(Boolean).join(" · ")}
                  {totals.spentCents > 0 ? <span>· {labels.spent} <Money cents={totals.spentCents} className="text-foreground" /></span> : null}
                  {totals.receivedCents > 0 ? <span>· {labels.received} <Money cents={totals.receivedCents} className="text-gain" /></span> : null}
                </p>
              ) : null}
            </div>

            {matches.length === 0 ? <Card className="px-4 py-6 text-center text-muted-foreground">{labels.noMatches}</Card> : null}
            {visibleDays.map((day) => (
              <div key={day.key}>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{day.heading}</h3>
                <Card><ul className="divide-y divide-border">{day.items.map((item) => <Fragment key={item.key}>{item.row}</Fragment>)}</ul></Card>
              </div>
            ))}
            {visibleInstallments.length > 0 ? (
              <div>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{labels.installments}</h3>
                <Card><ul className="divide-y divide-border">{visibleInstallments.map((item) => <Fragment key={item.key}>{item.row}</Fragment>)}</ul></Card>
              </div>
            ) : null}
          </div>
        )}
      </Section>
    </>
  );
}

