"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { MonthKey } from "@/lib/months";

/**
 * The Overview's title ("October 2026", or "2026"), which opens a small menu to switch between the month and year
 * views, keeping your place: a month's view goes to its year, and a year's to the same month of that year. It sits
 * in the title row so the rarely used switch takes no room of its own.
 */
export function OverviewToggle({ view, month, locale, title, labels }: {
  view: "month" | "year";
  /** The month shown, or for the year view, the month of that year to open. */
  month: MonthKey;
  locale: Locale;
  title: string;
  labels: { month: string; year: string };
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const options = [
    { view: "month" as const, label: labels.month, href: `/${locale}/month?m=${month}` },
    { view: "year" as const, label: labels.year, href: `/${locale}/year?year=${month.slice(0, 4)}` },
  ];

  return (
    <div className="relative" ref={menu}>
      <h1>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex min-h-11 items-center gap-1 rounded-full px-3 font-display text-xl font-semibold transition hover:bg-surface"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {title}
          <ChevronDown aria-hidden="true" className={cn("size-4 text-muted-foreground transition", open && "rotate-180")} />
        </button>
      </h1>
      {open ? (
        <div className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg" role="menu">
          {options.map((option) => (
            <Link
              aria-current={option.view === view ? "page" : undefined}
              className="flex min-h-11 items-center justify-between px-4 text-sm font-medium transition hover:bg-background"
              href={option.href}
              key={option.view}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              {option.label}
              {option.view === view ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
