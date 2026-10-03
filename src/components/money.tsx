import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";

/** Amounts always use DM Mono with tabular figures so columns of numbers line up. */
export function Money({ cents, className, signed = false }: { cents: number; className?: string; signed?: boolean }) {
  const prefix = signed && cents > 0 ? "+" : "";
  return <span className={cn("font-mono tabular-nums", className)}>{prefix}{formatCents(cents)}</span>;
}
