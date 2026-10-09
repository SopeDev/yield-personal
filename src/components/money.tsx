"use client";

import { cn } from "@/lib/cn";
import { formatCentsIn } from "@/lib/money";
import { useCurrency } from "./currency";

/**
 * Amounts always use DM Mono with tabular figures so columns of numbers line up. They're in the user's main
 * currency unless `currency` says otherwise (a record in another currency, like a dollar income), which then shows
 * a distinct symbol ("US$").
 */
export function Money({ cents, className, signed = false, currency }: { cents: number; className?: string; signed?: boolean; currency?: string }) {
  const mainCurrency = useCurrency();
  const prefix = signed && cents > 0 ? "+" : "";
  return <span className={cn("font-mono tabular-nums", className)}>{prefix}{formatCentsIn(cents, currency ?? mainCurrency, mainCurrency)}</span>;
}
