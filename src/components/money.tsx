"use client";

import { cn } from "@/lib/cn";
import { formatCentsIn, formatWholeUnits } from "@/lib/money";
import { useCurrency } from "./currency";

/**
 * Amounts always use DM Mono with tabular figures so columns of numbers line up. They're in the user's main
 * currency unless `currency` says otherwise (a record in another currency, like a dollar income), which then shows
 * a distinct symbol ("US$"). `whole` rounds to whole units, for figures where cents are false precision (projections).
 */
export function Money({ cents, className, signed = false, currency, whole = false }: { cents: number; className?: string; signed?: boolean; currency?: string; whole?: boolean }) {
  const mainCurrency = useCurrency();
  const prefix = signed && cents > 0 ? "+" : "";
  const text = whole ? formatWholeUnits(cents, currency ?? mainCurrency) : formatCentsIn(cents, currency ?? mainCurrency, mainCurrency);
  return <span className={cn("font-mono tabular-nums", className)}>{prefix}{text}</span>;
}
