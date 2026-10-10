import Link from "next/link";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { InfoDialog } from "@/components/info-dialog";
import { Money } from "@/components/money";
import { Card } from "@/components/section";
import type { Locale } from "@/i18n/config";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  explainStat, resolveStats, statDescription, type ResolvedStat, type StatContext, type StatExplanation as StatExplanationLines, type StatFigure, type StatTone,
  type StatValue, type SummaryCardLayout,
} from "@/lib/stats";

const toneClass: Record<StatTone, string> = { gain: "text-gain", loss: "text-loss", warning: "text-warning", muted: "text-muted-foreground" };

/**
 * A headline figure above a two-column grid of stats, as laid out by a summary card layout, with a link to customize
 * it. Tapping a stat opens what it is and how this month's figures come to it.
 */
export function SummaryCard({ layout, context, messages, locale, customizeHref }: {
  layout: SummaryCardLayout;
  context: StatContext;
  messages: Messages;
  locale: Locale;
  customizeHref?: string;
}) {
  const explained = (stat: ResolvedStat): CardStat => ({
    key: stat.ref,
    label: stat.label,
    value: stat.value,
    description: statDescription(stat.ref, context, messages),
    explanation: explainStat(stat.ref, context, messages, locale),
  });
  const [headline] = resolveStats([layout.headline], context, messages).map(explained);
  const card = <StatsCard grid={resolveStats(layout.grid, context, messages).map(explained)} headline={headline} messages={messages} />;
  if (!customizeHref) return card;
  return (
    <div>
      {card}
      <div className="flex justify-end">
        <Link className="inline-flex min-h-9 items-center px-1 text-xs font-medium text-muted-foreground hover:text-foreground" href={customizeHref}>
          {messages.summary.customize}
        </Link>
      </div>
    </div>
  );
}

/** A figure on a card, with what it is and how it is worked out, shown when it is tapped. */
export type CardStat = { key: string; label: string; value: StatValue; description: string; explanation: StatExplanationLines };

/** The summary card's look, whatever calculated its figures: a headline above a two-column grid, each figure tappable. */
export function StatsCard({ headline, grid, messages }: { headline?: CardStat; grid: CardStat[]; messages: Messages }) {
  const explained = (stat: CardStat, trigger: ReactNode, triggerClassName: string) => (
    <InfoDialog closeLabel={messages.common.close} label={trigger} title={stat.label} triggerClassName={triggerClassName}>
      <StatExplanation description={stat.description} explanation={stat.explanation} messages={messages} />
    </InfoDialog>
  );
  return (
    // Clips the cells' hover tint to the card's rounded corners; the dialogs open above everything regardless.
    <Card className="overflow-hidden">
      {headline ? (
        <div className="border-b border-border">
          {explained(headline, (
            <>
              <StatLabel label={headline.label} messages={messages} />
              {headline.value ? (
                <>
                  <Figure className={cn("mt-1 block text-3xl", headline.value.tone && toneClass[headline.value.tone])} messages={messages} value={headline.value} />
                  {headline.value.note ? <span className={cn("mt-1 block text-xs", toneClass[headline.value.note.tone])}>{headline.value.note.text}</span> : null}
                </>
              ) : <span className="mt-1 block text-3xl text-subtle">–</span>}
            </>
          ), "block w-full px-4 py-4 text-center transition hover:bg-background/60")}
        </div>
      ) : null}
      {/* A stat left alone on the last row takes the whole row. */}
      <div className="grid grid-cols-2 divide-x divide-border text-center [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border [&>*:last-child:nth-child(odd)]:col-span-2">
        {grid.map((stat) => (
          <div key={stat.key}>
            {explained(stat, <StatCell messages={messages} stat={stat} />, "block h-full w-full px-2 py-3 text-center transition hover:bg-background/60")}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** A stat's label with the ⓘ that marks it as tappable. */
function StatLabel({ label, messages }: { label: string; messages: Messages }) {
  return (
    <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
      {label}
      <Info aria-hidden="true" className="size-3 shrink-0 opacity-70" />
      <span className="sr-only">{messages.explain.howCalculated}</span>
    </span>
  );
}

/** A stat's amount, or its number of days in the same type as amounts. */
function Figure({ value, messages, className }: { value: NonNullable<StatValue>; messages: Messages; className?: string }) {
  if (value.days === undefined) return <Money cents={value.cents} className={className} />;
  const text = value.days === 1 ? messages.month.dayCountOne : format(messages.month.dayCount, { count: value.days });
  return <span className={cn("font-mono tabular-nums", className)}>{text}</span>;
}

function StatCell({ stat: { label, value }, messages }: { stat: CardStat; messages: Messages }) {
  return (
    <>
      <StatLabel label={label} messages={messages} />
      <span className="mt-1 block text-sm font-medium sm:text-base">
        {value ? (
          <>
            <Figure className={value.tone && toneClass[value.tone]} messages={messages} value={value} />
            {value.note ? <span className={cn("mt-0.5 block text-xs font-normal", toneClass[value.note.tone])}>{value.note.text}</span> : null}
          </>
        ) : <span className="text-subtle">–</span>}
      </span>
    </>
  );
}

/** A figure in a stat's working: an amount, or a number of days, paydays, or months. */
function WorkingFigure({ figure, messages }: { figure: StatFigure; messages: Messages }) {
  if ("cents" in figure) return <Money cents={figure.cents} />;
  const count = (value: number, one: string, many: string) => (value === 1 ? one : format(many, { count: value }));
  const text = "days" in figure ? count(figure.days, messages.month.dayCountOne, messages.month.dayCount)
    : "paydays" in figure ? count(figure.paydays, messages.explain.paydayCountOne, messages.explain.paydayCount)
      : count(figure.months, messages.explain.monthCountOne, messages.explain.monthCount);
  return <span className="font-mono tabular-nums">{text}</span>;
}

/** What a stat is, then how its figures come to it, line by line like a receipt, then notes. */
function StatExplanation({ description, explanation: { blocks, notes }, messages }: { description: string; explanation: StatExplanationLines; messages: Messages }) {
  return (
    <>
      <p className="px-4 py-3 text-sm text-muted-foreground">{description}</p>
      {blocks.map((lines, index) => (
        <dl className="border-t border-border py-1 text-sm" key={index}>
          {lines.map((line, lineIndex) => (
            <div
              className={cn("flex items-baseline justify-between gap-3 px-4 py-2", line.op === "=" && "font-semibold", line.op === "=" && lineIndex > 0 && "border-t border-dashed border-border")}
              key={lineIndex}
            >
              <dt className="min-w-0">{line.op ? `${line.op} ` : null}{line.label}</dt>
              <dd className="shrink-0"><WorkingFigure figure={line.figure} messages={messages} /></dd>
            </div>
          ))}
        </dl>
      ))}
      {notes.length > 0 ? (
        <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      ) : null}
    </>
  );
}
