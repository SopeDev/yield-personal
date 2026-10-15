import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { EstimateCheck } from "@/lib/estimate-check";
import { formatCents } from "@/lib/money";

/**
 * The starting estimates beside what the records so far come to a month, for a new account's first weeks. Spending
 * over its estimate reads yellow, income under its estimate too: either way the month is tighter than guessed.
 */
export function EstimateCheckCard({ check, categoryLabel, currency, labels }: {
  check: EstimateCheck;
  categoryLabel: (categoryId: string) => string;
  currency: string;
  labels: Messages["estimates"];
}) {
  const rows = [
    ...check.spending.map((row) => ({ key: row.categoryId, label: categoryLabel(row.categoryId), ...row, tight: row.paceCents > row.estimatedCents })),
    ...(check.income ? [{ key: "income", label: labels.income, ...check.income, tight: check.income.paceCents < check.income.estimatedCents }] : []),
  ];
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="space-y-1 px-4 pb-2 pt-3">
        <h2 className="font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">{format(labels.body, { days: check.days })}</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => (
          <li className="px-4 py-2.5" key={row.key}>
            <p className="font-medium">{row.label}</p>
            <p className="text-sm text-muted-foreground">
              {format(labels.line, { estimate: formatCents(row.estimatedCents, currency) })}
              {" · "}
              <span className={cn("font-medium", row.tight ? "text-warning" : "text-foreground")}>{format(labels.pace, { amount: formatCents(row.paceCents, currency) })}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
