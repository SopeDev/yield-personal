import Link from "next/link";
import { setStatementPaid } from "@/app/actions/recurring";
import type { Locale } from "@/i18n/config";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { daysBetween, formatShortDate } from "@/lib/dates";
import { dateKeyOf } from "@/lib/months";
import type { Statement } from "@/lib/statements";
import { Money } from "./money";
import { PaidToggle } from "./paid-toggle";

/** A card statement with its closing and due dates, how long until it's due, and a paid toggle. */
export function StatementRow({ statement, card, today, locale, messages }: {
  statement: Statement;
  card: { name: string; color: string } | undefined;
  today: string;
  locale: Locale;
  messages: Messages;
}) {
  const closingKey = dateKeyOf(statement.closingDate);
  const daysUntilDue = daysBetween(today, dateKeyOf(statement.dueDate));
  const closed = closingKey <= today;
  const closingLabel = format(closed ? messages.month.closed : messages.month.closes, { date: formatShortDate(statement.closingDate, locale) });
  const dueLabel = format(messages.cards.due, { date: formatShortDate(statement.dueDate, locale) });

  // As with recurring payments: yellow 1–2 days before the due date, red on it and after. A closed, unpaid
  // statement's closing date turns green: its total is final and it can be paid now.
  let timing: { text: string; tone: string } | null = null;
  if (!statement.paid) {
    if (daysUntilDue < 0) timing = { text: format(messages.month.overdueBy, { days: -daysUntilDue }), tone: "text-loss" };
    else if (daysUntilDue === 0) timing = { text: messages.month.dueToday, tone: "text-loss" };
    else if (daysUntilDue === 1) timing = { text: messages.month.dueTomorrow, tone: "text-warning" };
    else if (daysUntilDue === 2) timing = { text: format(messages.month.dueIn, { days: daysUntilDue }), tone: "text-warning" };
    else timing = { text: format(messages.month.dueIn, { days: daysUntilDue }), tone: "text-muted-foreground" };
  }

  return (
    <li className="flex items-center gap-3 py-3 pl-4 pr-3">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card?.color }} />
      <Link className="min-w-0 flex-1" href={`/${locale}/cards`}>
        <p className="truncate font-medium">{format(messages.month.statementDue, { card: card?.name ?? "" })}</p>
        <p className="truncate text-sm text-muted-foreground">
          <span className={cn(closed && !statement.paid && "font-medium text-gain")}>{closingLabel}</span> · {dueLabel}
        </p>
        {timing ? <p className={cn("text-sm font-medium", timing.tone)}>{timing.text}</p> : null}
      </Link>
      <Money cents={statement.totalCents} />
      <PaidToggle
        action={setStatementPaid}
        fields={{ locale, paymentMethodId: statement.paymentMethodId, statementMonth: statement.month }}
        labels={{ paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid }}
        paid={statement.paid}
      />
    </li>
  );
}
