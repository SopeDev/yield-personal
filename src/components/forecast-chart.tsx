"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { Money } from "./money";

export type ForecastChartDay = {
  /** "Nov 1" in the user's language. */
  label: string;
  cents: number;
  events: { label: string; cents: number; estimated: boolean; overdue: boolean }[];
};

/**
 * Cash on hand day by day: a line from today, solid for the days near enough to trust (`sureDays`) and dashed
 * after, with a mark under each day money comes or goes. Dragging across it (or the
 * arrow keys) picks a day, whose cash and events show above.
 */
export function ForecastChart({ days, sureDays, ticks, labels }: {
  days: ForecastChartDay[];
  sureDays: number;
  /** Month starts to label under the line. */
  ticks: { index: number; label: string }[];
  labels: { title: string; estimated: string; overdue: string; noEvents: string };
}) {
  const [selected, setSelected] = useState(0);
  const plot = useRef<HTMLDivElement>(null);
  const values = days.map((day) => day.cents);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  // A little room above and below the line.
  const pad = (max - min || 1) * 0.06;
  const top = max + pad;
  const bottom = min - pad;
  const last = days.length - 1;
  // Positions as percentages of the plot: x from the left, y from the top.
  const x = (index: number) => (index / last) * 100;
  const y = (cents: number) => ((top - cents) / (top - bottom)) * 100;
  const points = (from: number, to: number) => days.slice(from, to + 1).map((day, offset) => `${x(from + offset)},${y(day.cents)}`).join(" ");
  const sureEnd = Math.min(sureDays, last);
  const day = days[selected];

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box) return;
    setSelected(Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * last));
  };
  const step = (event: KeyboardEvent) => {
    const move = { ArrowLeft: -1, ArrowRight: 1, Home: -selected, End: last - selected }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    setSelected((current) => Math.min(last, Math.max(0, current + move)));
  };

  return (
    <section aria-label={labels.title} className="space-y-3">
      <div aria-live="polite" className="min-h-14">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{day.label}</span>
          <Money cents={day.cents} className={cn("text-xl font-semibold", day.cents < 0 ? "text-loss" : "text-foreground")} />
        </p>
        {day.events.length === 0 ? <p className="text-xs text-subtle">{labels.noEvents}</p> : (
          <ul className="mt-1 space-y-0.5 text-xs">
            {day.events.map((event, index) => (
              <li className="flex justify-between gap-3" key={`${event.label}-${index}`}>
                <span className="truncate text-muted-foreground">
                  {event.label}
                  {event.overdue ? <span className="ml-1 text-warning">· {labels.overdue}</span> : event.estimated ? <span className="ml-1 text-subtle">· {labels.estimated}</span> : null}
                </span>
                <Money cents={event.cents} className={event.cents < 0 ? "text-foreground" : "text-gain"} signed />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        aria-label={labels.title}
        aria-valuemax={last}
        aria-valuemin={0}
        aria-valuenow={selected}
        aria-valuetext={day.label}
        className="relative h-44 cursor-crosshair touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
        onKeyDown={step}
        onPointerDown={pick}
        onPointerMove={(event) => (event.buttons > 0 || event.pointerType === "mouse") && pick(event)}
        ref={plot}
        role="slider"
        tabIndex={0}
      >
        {min < 0 ? <div aria-hidden="true" className="absolute inset-x-0 border-t border-loss/50" style={{ top: `${y(0)}%` }} /> : null}
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polyline className="stroke-primary" fill="none" points={points(0, sureEnd)} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {sureEnd < last ? (
            <polyline className="stroke-primary/50" fill="none" points={points(sureEnd, last)} strokeDasharray="4 4" strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        <div aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${x(selected)}%` }} />
        <span
          aria-hidden="true"
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: `${x(selected)}%`, top: `${y(day.cents)}%` }}
        />
      </div>

      <div aria-hidden="true" className="relative h-2">
        {days.map((entry, index) => entry.events.length === 0 ? null : (
          <span
            className={cn("absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full", entry.events.some((event) => event.cents < 0) ? "bg-foreground/50" : "bg-gain")}
            key={entry.label}
            style={{ left: `${x(index)}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative h-4 text-[10px] text-muted-foreground">
        {ticks.map((tick) => (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" key={tick.label} style={{ left: `${Math.min(94, Math.max(6, x(tick.index)))}%` }}>{tick.label}</span>
        ))}
      </div>
    </section>
  );
}
