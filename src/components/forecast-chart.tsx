"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { axisTicks, compactAmount } from "@/lib/forecast";
import { Money } from "./money";

export type ForecastChartDay = {
  /** "Nov 1" in the user's language. */
  label: string;
  cents: number;
  /** The cash with no income from today on. */
  withoutWorkCents: number;
  events: { label: string; cents: number; estimated: boolean; overdue: boolean }[];
};

/**
 * Cash on hand day by day: a line from today, solid for the days near enough to trust (`sureDays`) and dashed
 * after, and in red the cash if no income came in, against amounts down the left. A mark under each day money
 * comes or goes. Dragging across it (or the arrow keys) picks a day, whose cash, cash without work, and events
 * show above.
 */
export function ForecastChart({ days, sureDays, ticks, labels }: {
  days: ForecastChartDay[];
  sureDays: number;
  /** Month starts to label under the line. */
  ticks: { index: number; label: string }[];
  labels: { title: string; estimated: string; overdue: string; noEvents: string; forecast: string; withoutWork: string };
}) {
  const [selected, setSelected] = useState(0);
  const plot = useRef<HTMLDivElement>(null);
  const values = days.flatMap((day) => [day.cents, day.withoutWorkCents]);
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
  const points = (from: number, to: number, value: (day: ForecastChartDay) => number) =>
    days.slice(from, to + 1).map((day, offset) => `${x(from + offset)},${y(value(day))}`).join(" ");
  const cash = (day: ForecastChartDay) => day.cents;
  const withoutWork = (day: ForecastChartDay) => day.withoutWorkCents;
  const amounts = axisTicks(bottom, top);
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
        <p className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-loss/80">{labels.withoutWork}</span>
          <Money cents={day.withoutWorkCents} className="text-loss/80" />
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
        className="relative ml-9 h-48 cursor-crosshair touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        onKeyDown={step}
        onPointerDown={pick}
        onPointerMove={(event) => (event.buttons > 0 || event.pointerType === "mouse") && pick(event)}
        ref={plot}
        role="slider"
        tabIndex={0}
      >
        {amounts.map((amount) => (
          <div aria-hidden="true" className={cn("absolute inset-x-0 border-t", amount === 0 ? "border-muted-foreground/50" : "border-border/60")} key={amount} style={{ top: `${y(amount)}%` }}>
            <span className="absolute right-full -translate-y-1/2 pr-2 text-[10px] tabular-nums text-muted-foreground">{compactAmount(amount)}</span>
          </div>
        ))}
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polyline className="stroke-loss/80" fill="none" points={points(0, sureEnd, withoutWork)} strokeLinejoin="round" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {sureEnd < last ? (
            <polyline className="stroke-loss/40" fill="none" points={points(sureEnd, last, withoutWork)} strokeDasharray="4 4" strokeLinejoin="round" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ) : null}
          <polyline className="stroke-primary" fill="none" points={points(0, sureEnd, cash)} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {sureEnd < last ? (
            <polyline className="stroke-primary/50" fill="none" points={points(sureEnd, last, cash)} strokeDasharray="4 4" strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ) : null}
        </svg>
        <div aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${x(selected)}%` }} />
        <span
          aria-hidden="true"
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: `${x(selected)}%`, top: `${y(day.cents)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-loss"
          style={{ left: `${x(selected)}%`, top: `${y(day.withoutWorkCents)}%` }}
        />
      </div>

      <div aria-hidden="true" className="relative ml-9 h-2">
        {days.map((entry, index) => entry.events.length === 0 ? null : (
          <span
            className={cn("absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full", entry.events.some((event) => event.cents < 0) ? "bg-foreground/50" : "bg-gain")}
            key={entry.label}
            style={{ left: `${x(index)}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative ml-9 h-4 text-[10px] text-muted-foreground">
        {ticks.map((tick) => (
          <span className="absolute -translate-x-1/2 whitespace-nowrap" key={tick.label} style={{ left: `${Math.min(94, Math.max(6, x(tick.index)))}%` }}>{tick.label}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-primary" />{labels.forecast}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-loss/80" />{labels.withoutWork}</span>
      </div>
    </section>
  );
}
