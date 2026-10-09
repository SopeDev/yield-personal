import type { ReactNode } from "react";
import Link from "next/link";
import { Money } from "./money";

/** One ledger line: a colored dot for how it was paid, a title and details, and the amount. `href` opens it for editing. */
export function EntryRow({ color, title, details, cents, currency, signed, trailing, href }: {
  color: string;
  title: string;
  details: string;
  cents: number;
  /** The record's currency, when it isn't the main one. */
  currency?: string;
  signed?: boolean;
  trailing?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{details}</p>
      </div>
      <Money cents={cents} className={signed ? "text-gain" : undefined} currency={currency} signed={signed} />
    </>
  );
  return (
    <li className="flex items-center gap-3 py-3 pl-4 pr-2">
      {href ? <Link className="flex min-w-0 flex-1 items-center gap-3" href={href}>{body}</Link> : body}
      {trailing}
    </li>
  );
}
