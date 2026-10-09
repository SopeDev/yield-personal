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

/** From this many days out, a due date shows as the date; closer than that, as a countdown. */
const DUE_DATE_SHOWN_FROM_DAYS = 7;

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

  // The due date shows as a date a week or more out (or once paid), and as a countdown when it's close: yellow
  // 1–2 days before, red on the day and after, as with recurring payments. A closed, unpaid statement's closing
  // date turns green: its total is final and it can be paid now.
  let due = { text: format(messages.cards.due, { date: formatShortDate(statement.dueDate, locale) }), tone: "text-muted-foreground" };
  if (!statement.paid && daysUntilDue < DUE_DATE_SHOWN_FROM_DAYS) {
    if (daysUntilDue < 0) due = { text: format(messages.month.overdueBy, { days: -daysUntilDue }), tone: "text-loss" };
    else if (daysUntilDue === 0) due = { text: messages.month.dueToday, tone: "text-loss" };
    else if (daysUntilDue === 1) due = { text: messages.month.dueTomorrow, tone: "text-warning" };
    else due = { text: format(messages.month.dueIn, { days: daysUntilDue }), tone: daysUntilDue === 2 ? "text-warning" : "text-muted-foreground" };
  }

  return (
    <li className="flex items-center gap-3 py-3 pl-4 pr-3">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: card?.color }} />
      <Link className="min-w-0 flex-1" href={`/${locale}/cards`}>
        <p className="truncate font-medium">{format(messages.month.statementDue, { card: card?.name ?? "" })}</p>
        <p className={cn("truncate text-sm text-muted-foreground", closed && !statement.paid && "font-medium text-gain")}>{closingLabel}</p>
        <p className={cn("truncate text-sm", due.tone, due.tone !== "text-muted-foreground" && "font-medium")}>{due.text}</p>
      </Link>
      <Money cents={statement.totalCents} currency={statement.currency} />
      <PaidToggle
        action={setStatementPaid}
        fields={{ locale, paymentMethodId: statement.paymentMethodId, statementMonth: statement.month }}
        labels={{ paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid }}
        paid={statement.paid}
      />
    </li>
  );
}
