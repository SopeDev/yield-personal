import Link from "next/link";
import { setStatementPaid } from "@/app/actions/recurring";
import { Money } from "@/components/money";
import { PaidToggle } from "@/components/paid-toggle";
import { Card } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { formatShortDate } from "@/lib/dates";
import { getRecurringDefinitions, getStatements } from "@/lib/ledger-data";
import { addMonths, dateKeyOf } from "@/lib/months";
import type { Statement } from "@/lib/statements";
import { currentMonthKey, todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

/** Statements shown start this many months back; older ones are history. */
const HISTORY_MONTHS = 3;
/** A purchase's installments can reach a statement up to 48 months after the one it starts on. */
const PURCHASE_LOOKBACK_MONTHS = HISTORY_MONTHS + 48;

type StatementState = "paid" | "open" | "upcoming" | "overdue" | "due";

export default async function CardsPage({ params }: PageProps<"/[locale]/cards">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();
  const today = todayKey();
  const firstMonth = addMonths(currentMonth, -HISTORY_MONTHS);

  const definitions = await getRecurringDefinitions(userId);
  const { cards, statements } = await getStatements(userId, {
    purchasesFrom: addMonths(currentMonth, -PURCHASE_LOOKBACK_MONTHS),
    recurringFrom: addMonths(firstMonth, -1),
    recurringTo: currentMonth,
    definitions,
  });

  const visibleCards = cards.filter((card) => !card.archivedAt || statements.some((statement) => statement.paymentMethodId === card.id && !statement.paid));
  const toggleLabels = { paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid };
  const stateLabels: Record<StatementState, string> = {
    paid: messages.common.paid,
    open: messages.cards.open,
    upcoming: messages.cards.upcoming,
    overdue: messages.cards.overdue,
    due: messages.cards.dueSoon,
  };

  function statementState(statement: Statement, isFirstOpen: boolean): StatementState {
    if (statement.paid) return "paid";
    if (dateKeyOf(statement.closingDate) >= today) return isFirstOpen ? "open" : "upcoming";
    return dateKeyOf(statement.dueDate) < today ? "overdue" : "due";
  }

  if (visibleCards.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold">{messages.cards.title}</h1>
        <Card className="px-4 py-8 text-center">
          <p className="text-muted-foreground">{messages.cards.empty}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/settings`}>
            {messages.add.goToSettings}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold">{messages.cards.title}</h1>

      {visibleCards.map((card) => {
        const cardStatements = statements.filter((statement) => statement.paymentMethodId === card.id && statement.month >= firstMonth);
        const firstOpenMonth = cardStatements.find((statement) => dateKeyOf(statement.closingDate) >= today)?.month;
        const installmentsOwedCents = cardStatements
          .filter((statement) => !statement.paid)
          .flatMap((statement) => statement.charges)
          .filter((charge) => charge.installmentCount > 1)
          .reduce((sum, charge) => sum + charge.amountCents, 0);

        return (
          <section className="space-y-3" key={card.id}>
            <div className="flex items-center gap-3 px-1">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: card.color }} />
              <h2 className="flex-1 font-display text-lg font-semibold">{card.name}</h2>
              {installmentsOwedCents > 0 ? (
                <p className="text-right text-xs text-muted-foreground">
                  {messages.cards.msiOwed}
                  <Money cents={installmentsOwedCents} className="block text-sm text-foreground" />
                </p>
              ) : null}
            </div>

            <Card>
              {cardStatements.length === 0 ? (
                <p className="px-4 py-4 text-muted-foreground">{messages.cards.noCharges}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {cardStatements.map((statement) => {
                    const state = statementState(statement, statement.month === firstOpenMonth);
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
                            <Money cents={statement.totalCents} />
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
                                <Money cents={charge.amountCents} />
                              </li>
                            ))}
                          </ul>
                          {state !== "upcoming" ? (
                            <div className="flex justify-end border-t border-border px-4 py-3">
                              <PaidToggle action={setStatementPaid} fields={{ locale, paymentMethodId: card.id, statementMonth: statement.month }} labels={toggleLabels} paid={statement.paid} />
                            </div>
                          ) : null}
                        </details>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
