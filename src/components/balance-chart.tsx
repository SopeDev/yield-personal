"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Money } from "./money";

export type ChartBar = {
  /** The month's initial under its bar, and its full name and description for the readout and screen readers. */
  initial: string;
  name: string;
  description: string;
  /** Null for a month without a bar (not started, or before the history start). */
  cents: number | null;
  note: { text: string; tone: "gain" | "loss" | "muted" } | null;
};

const noteTone = { gain: "text-gain", loss: "text-loss", muted: "text-muted-foreground" };

/**
 * A month-by-month balance chart: a bar per month from a zero line (green above, red below) and a dashed goal line.
 * Tapping or hovering a bar shows its month, amount, and goal progress above the chart; `selected` starts on the
 * current month.
 */
export function BalanceChart({ title, bars, goalCents, goalLabel, selected: initialSelected }: {
  title: string;
  bars: ChartBar[];
  goalCents: number | null;
  goalLabel: string | null;
  selected: number;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const values = bars.flatMap((bar) => (bar.cents === null ? [] : [bar.cents]));
  const min = Math.min(0, ...values);
  // Headroom above the highest value, so the goal line's label never meets the readout.
  const max = Math.max(0, ...values, goalCents ?? 0);
  const range = (max - min || 1) * 1.15;
  // Distance from the bottom of the plot, as a percentage of its height.
  const at = (cents: number) => ((cents - min) / range) * 100;
  const zero = at(0);
  const current = bars[selected];

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
        <p aria-live="polite" className="text-right text-xs">
          <span className="text-muted-foreground">{current.name}</span>
          {current.cents === null ? null : (
            <Money cents={current.cents} className={cn("ml-2 text-sm font-medium", current.cents < 0 ? "text-loss" : "text-gain")} />
          )}
          {current.note ? <span className={cn("block", noteTone[current.note.tone])}>{current.note.text}</span> : null}
        </p>
      </div>
      <div className="relative h-36">
        <div aria-hidden="true" className="absolute inset-x-0 border-t border-border" style={{ bottom: `${zero}%` }} />
        {goalCents !== null && goalLabel ? (
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ bottom: `${at(goalCents)}%` }}>
            <span className="absolute right-0 -top-4 text-[10px] text-muted-foreground">{goalLabel}</span>
          </div>
        ) : null}
        <div className="absolute inset-0 flex gap-0.5">
          {bars.map((bar, index) => {
            const positive = bar.cents !== null && bar.cents >= 0;
            const top = bar.cents === null ? zero : at(bar.cents);
            return (
              <button
                aria-label={bar.description}
                aria-pressed={index === selected}
                className="relative h-full flex-1 rounded-md transition hover:bg-surface/60"
                key={bar.name}
                onClick={() => setSelected(index)}
                onMouseEnter={() => setSelected(index)}
                type="button"
              >
                {bar.cents === null ? null : (
                  <span
                    className={cn(
                      "absolute left-1/2 w-3/5 max-w-6 min-h-0.5 -translate-x-1/2 transition-opacity",
                      positive ? "rounded-t bg-gain" : "rounded-b bg-loss",
                      index === selected ? "opacity-100" : "opacity-55",
                    )}
                    style={{ bottom: `${Math.min(zero, top)}%`, height: `${Math.abs(top - zero)}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-0.5">
        {bars.map((bar, index) => (
          <span
            className={cn("flex-1 text-center text-[10px]", index === selected ? "font-semibold text-foreground" : bar.cents === null ? "text-subtle" : "text-muted-foreground")}
            key={bar.name}
          >
            {bar.initial}
          </span>
        ))}
      </div>
    </section>
  );
}
