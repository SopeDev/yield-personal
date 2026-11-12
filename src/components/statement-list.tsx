import { setStatementPaid } from "@/app/actions/recurring";
import type { Locale } from "@/i18n/config";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { dateKeyOf } from "@/lib/months";
import type { Statement } from "@/lib/statements";
import { Money } from "./money";
import { PaidToggle } from "./paid-toggle";

type StatementState = "paid" | "open" | "upcoming" | "overdue" | "due";

/** A statement's state: paid; still collecting charges (the first such is open, later ones upcoming); or closed and owed, overdue once its due date has passed. */
function statementState(statement: Statement, today: string, isFirstOpen: boolean): StatementState {
  if (statement.paid) return "paid";
  if (dateKeyOf(statement.closingDate) >= today) return isFirstOpen ? "open" : "upcoming";
  return dateKeyOf(statement.dueDate) < today ? "overdue" : "due";
}

/**
 * A card's statements as rows: due and closing dates, state, and total, each opening to its charges and (once it has
 * closed or is open) a paid toggle.
 */
export function StatementList({ statements, cardId, currency, locale, messages, today }: {
  statements: Statement[];
  cardId: string;
  currency: string;
  locale: Locale;
  messages: Messages;
  today: string;
}) {
  const firstOpenMonth = statements.find((statement) => dateKeyOf(statement.closingDate) >= today)?.month;
  const toggleLabels = { paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid };
  const stateLabels: Record<StatementState, string> = {
    paid: messages.common.paid,
    open: messages.cards.open,
    upcoming: messages.cards.upcoming,
    overdue: messages.cards.overdue,
    due: messages.cards.dueSoon,
  };
  return (
    <ul className="divide-y divide-border">
      {statements.map((statement) => {
        const state = statementState(statement, today, statement.month === firstOpenMonth);
        return (
          <li key={statement.month}>
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{format(messages.cards.due, { date: formatShortDate(statement.dueDate, locale) })}</p>
                  <p className="text-sm text-muted-foreground">{format(messages.cards.closes, { date: formatShortDate(statement.closingDate, locale) })}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    state === "paid" && "bg-primary/15 text-primary",
                    state === "overdue" && "bg-loss/15 text-loss",
                    state === "due" && "bg-warning/15 text-warning",
                    (state === "open" || state === "upcoming") && "bg-background text-muted-foreground",
                  )}
                >
                  {stateLabels[state]}
                </span>
                <Money cents={statement.totalCents} currency={currency} />
              </summary>
              <ul className="border-t border-border bg-background/40">
                {statement.charges.map((charge) => (
                  <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm" key={`${charge.id}-${charge.installmentNumber}`}>
                    <div className="min-w-0">
                      <p className="truncate">{charge.description}</p>
                      <p className="text-muted-foreground">
                        {[
                          formatShortDate(charge.date, locale),
                          charge.kind === "recurring" ? messages.cards.recurringCharge : null,
                          charge.installmentCount > 1 ? format(messages.cards.installment, { number: charge.installmentNumber, count: charge.installmentCount }) : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Money cents={charge.amountCents} currency={currency} />
                  </li>
                ))}
              </ul>
              {state !== "upcoming" ? (
                <div className="flex justify-end border-t border-border px-4 py-3">
                  <PaidToggle action={setStatementPaid} fields={{ locale, paymentMethodId: cardId, statementMonth: statement.month }} labels={toggleLabels} paid={statement.paid} />
                </div>
              ) : null}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
