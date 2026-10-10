import Link from "next/link";
import { Money } from "@/components/money";
import { Card } from "@/components/section";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { resolveStats, type ResolvedStat, type StatContext, type StatTone, type StatValue, type SummaryCardLayout } from "@/lib/stats";

const toneClass: Record<StatTone, string> = { gain: "text-gain", loss: "text-loss", warning: "text-warning", muted: "text-muted-foreground" };

/** A headline figure above a two-column grid of stats, as laid out by a summary card layout, with a link to customize it. */
export function SummaryCard({ layout, context, messages, customizeHref }: {
  layout: SummaryCardLayout;
  context: StatContext;
  messages: Messages;
  customizeHref?: string;
}) {
  const [headline] = resolveStats([layout.headline], context, messages);
  const grid = resolveStats(layout.grid, context, messages);
  const card = (
    <Card>
      {headline ? (
        <div className="border-b border-border px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">{headline.label}</p>
          {headline.value ? (
            <>
              <Figure className={cn("mt-1 block text-3xl", headline.value.tone && toneClass[headline.value.tone])} messages={messages} value={headline.value} />
              {headline.value.note ? <p className={cn("mt-1 text-xs", toneClass[headline.value.note.tone])}>{headline.value.note.text}</p> : null}
            </>
          ) : <span className="mt-1 block text-3xl text-subtle">–</span>}
        </div>
      ) : null}
      <div className="grid grid-cols-2 divide-x divide-border text-center [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border">
        {grid.map((stat) => <StatCell key={stat.ref} messages={messages} stat={stat} />)}
      </div>
    </Card>
  );
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

/** A stat's amount, or its number of days in the same type as amounts. */
function Figure({ value, messages, className }: { value: NonNullable<StatValue>; messages: Messages; className?: string }) {
  if (value.days === undefined) return <Money cents={value.cents} className={className} />;
  const text = value.days === 1 ? messages.month.dayCountOne : format(messages.month.dayCount, { count: value.days });
  return <span className={cn("font-mono tabular-nums", className)}>{text}</span>;
}

function StatCell({ stat: { label, value }, messages }: { stat: ResolvedStat; messages: Messages }) {
  return (
    <div className="px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium sm:text-base">
        {value ? (
          <>
            <Figure className={value.tone && toneClass[value.tone]} messages={messages} value={value} />
            {value.note ? <span className={cn("mt-0.5 block text-xs font-normal", toneClass[value.note.tone])}>{value.note.text}</span> : null}
          </>
        ) : <span className="text-subtle">–</span>}
      </p>
    </div>
  );
}
