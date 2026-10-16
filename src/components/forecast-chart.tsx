"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { axisTicks, compactAmount } from "@/lib/forecast";
import { Money } from "./money";

export type ForecastChartDay = {
  /** "Nov 1" in the user's language. */
  label: string;
  cents: number;
  /** What leaves cash that day, as a positive amount. */
  spendingCents: number;
  /** Cash plus savings that day (the blue line), the savings alone, and the interest they've earned by then; null without savings. */
  savings: { totalCents: number; savingsCents: number; interestCents: number } | null;
  events: { label: string; cents: number; estimated: boolean; overdue: boolean; savings: boolean }[];
};

/**
 * Cash on hand day by day: a line from today, solid for the days near enough to trust (`sureDays`) and dashed
 * after, over red bars of what leaves cash each day (big bills and statements stand out against the everyday ones),
 * against amounts down the left, and with savings, a second line above it for cash plus savings growing with their
 * interest (the gap between the two is the savings). Money moved into savings stacks in blue on that day's bar: it
 * leaves cash without being spent. A mark under each day income comes in. Dragging across it (or the arrow keys)
 * picks a day, whose figures and events show above.
 */
export function ForecastChart({ days, sureDays, ticks, labels }: {
  days: ForecastChartDay[];
  sureDays: number;
  /** Month starts to label under the line. */
  ticks: { index: number; label: string }[];
  labels: { title: string; estimated: string; overdue: string; forecast: string; spending: string; noEvents: string; savings: string; withSavings: string };
}) {
  const [selected, setSelected] = useState(0);
  const plot = useRef<HTMLDivElement>(null);
  // What each day moves into savings, stacked on its spending bar.
  const saved = (day: ForecastChartDay) => -day.events.filter((event) => event.savings).reduce((sum, event) => sum + event.cents, 0);
  const values = days.flatMap((day) => [day.cents, day.spendingCents + saved(day), ...(day.savings ? [day.savings.totalCents] : [])]);
  const hasSavings = days.some((day) => day.savings !== null);
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
  const total = (day: ForecastChartDay) => day.savings?.totalCents ?? day.cents;
  // Each day's bar is centred on its point of the line, a little narrower than the day.
  const barWidth = (100 / (last + 1)) * 0.6;
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
      {/* The day's cash, its savings, what it spends, and what happens that day (or that it's an average day). */}
      <div aria-live="polite" className="min-h-14">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{day.label}</span>
          <Money cents={day.cents} className={cn("text-xl font-semibold", day.cents < 0 ? "text-loss" : "text-foreground")} whole />
        </p>
        {day.savings ? (
          <p className="flex items-baseline justify-between gap-3 text-xs text-sky-400">
            <span>{labels.savings}</span>
            <span>
              <Money cents={day.savings.savingsCents} whole />
              {day.savings.interestCents >= 100 ? <> · <Money cents={day.savings.interestCents} signed whole /></> : null}
            </span>
          </p>
        ) : null}
        <p className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-loss/80">{labels.spending}</span>
          <Money cents={-day.spendingCents} className="text-loss/80" signed whole />
        </p>
        {day.events.length === 0 ? <p className="text-xs text-subtle">{labels.noEvents}</p> : (
          <ul className="mt-1 space-y-0.5 text-xs">
            {day.events.map((event, index) => (
              <li className="flex justify-between gap-3" key={`${event.label}-${index}`}>
                <span className="truncate text-muted-foreground">
                  {event.label}
                  {event.overdue ? <span className="ml-1 text-warning">· {labels.overdue}</span> : event.estimated ? <span className="ml-1 text-subtle">· {labels.estimated}</span> : null}
                </span>
                <Money cents={event.cents} className={event.savings ? "text-sky-400" : event.cents < 0 ? "text-foreground" : "text-gain"} signed whole />
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
          {days.map((entry, index) => {
            const left = Math.min(100 - barWidth, Math.max(0, x(index) - barWidth / 2));
            const toSavings = saved(entry);
            return (
              <g key={entry.label}>
                {entry.spendingCents > 0 ? (
                  <rect className={index === selected ? "fill-loss" : index <= sureEnd ? "fill-loss/55" : "fill-loss/30"} height={y(0) - y(entry.spendingCents)} width={barWidth} x={left} y={y(entry.spendingCents)} />
                ) : null}
                {toSavings > 0 ? (
                  <rect
                    className={index === selected ? "fill-sky-400" : index <= sureEnd ? "fill-sky-400/70" : "fill-sky-400/40"}
                    height={y(entry.spendingCents) - y(entry.spendingCents + toSavings)}
                    width={barWidth}
                    x={left}
                    y={y(entry.spendingCents + toSavings)}
                  />
                ) : null}
              </g>
            );
          })}
          {hasSavings ? (
            <>
              <polyline className="stroke-sky-400" fill="none" points={points(0, sureEnd, total)} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {sureEnd < last ? (
                <polyline className="stroke-sky-400/50" fill="none" points={points(sureEnd, last, total)} strokeDasharray="4 4" strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ) : null}
            </>
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
        {day.savings ? (
          <span
            aria-hidden="true"
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-sky-400"
            style={{ left: `${x(selected)}%`, top: `${y(day.savings.totalCents)}%` }}
          />
        ) : null}
      </div>

      <div aria-hidden="true" className="relative ml-9 h-2">
        {days.map((entry, index) => !entry.events.some((event) => event.cents > 0) ? null : (
          <span
            className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-gain"
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
        {hasSavings ? <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-sky-400" />{labels.withSavings}</span> : null}
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-1.5 rounded-sm bg-loss/55" />{labels.spending}</span>
      </div>
    </section>
  );
}
