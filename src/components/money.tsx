"use client";

import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { useCurrency } from "./currency";

/** Amounts always use DM Mono with tabular figures so columns of numbers line up, in the user's main currency. */
export function Money({ cents, className, signed = false }: { cents: number; className?: string; signed?: boolean }) {
  const currency = useCurrency();
  const prefix = signed && cents > 0 ? "+" : "";
  return <span className={cn("font-mono tabular-nums", className)}>{prefix}{formatCents(cents, currency)}</span>;
}
