import type { ReactNode } from "react";
import { Money } from "./money";

/** One ledger line: a colored dot for how it was paid, a title and details, and the amount. */
export function EntryRow({ color, title, details, cents, signed, trailing }: {
  color: string;
  title: string;
  details: string;
  cents: number;
  signed?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-3 pl-4 pr-2">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{details}</p>
      </div>
      <Money cents={cents} className={signed ? "text-gain" : undefined} signed={signed} />
      {trailing}
    </li>
  );
}
