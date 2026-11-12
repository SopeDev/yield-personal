import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatementList } from "@/components/statement-list";
import { Money } from "@/components/money";
import { Card } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { loadLedgerRange } from "@/lib/ledger-data";
import { CARRY_UNPAID_MONTHS } from "@/lib/month-view";
import { addMonths } from "@/lib/months";
import { currentStatements, installmentsOwed } from "@/lib/statements";
import { currentMonthKey, todayKey } from "@/lib/today";

/** Each card's statements worth acting on: unpaid ones, the last one paid, and those still to close; older ones are in its history. */
export default async function CardsPage({ params }: PageProps<"/[locale]/cards">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();
  const today = todayKey();
  const carryFrom = addMonths(currentMonth, -CARRY_UNPAID_MONTHS);

  // Statements as far back as the month view carries unpaid ones, so an unpaid one shows however old it is (and an
  // archived card shows while it has any).
  const { data: { statements }, cards } = await loadLedgerRange(userId, currentMonth, currentMonth, { statementsFrom: carryFrom });

  const visibleCards = cards.filter((card) => !card.archivedAt || statements.some((statement) => statement.paymentMethodId === card.id && !statement.paid));
  if (visibleCards.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold">{messages.cards.title}</h1>
        <Card className="px-4 py-8 text-center">
          <p className="text-muted-foreground">{messages.cards.empty}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/settings/money`}>
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
        // What's worth acting on: every closed statement still unpaid, the last one paid, and every one still to close.
        const { shown: cardStatements, hasHistory } = currentStatements(statements.filter((statement) => statement.paymentMethodId === card.id), today, carryFrom);
        const installmentsOwedCents = installmentsOwed(cardStatements);

        return (
          <section className="space-y-3" key={card.id}>
            <div className="flex items-center gap-3 px-1">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: card.color }} />
              <h2 className="flex-1 font-display text-lg font-semibold">{card.name}</h2>
              {installmentsOwedCents > 0 ? (
                <p className="text-right text-xs text-muted-foreground">
                  {messages.cards.msiOwed}
                  <Money cents={installmentsOwedCents} className="block text-sm text-foreground" currency={card.currency} />
                </p>
              ) : null}
            </div>

            <Card>
              {cardStatements.length === 0 ? (
                <p className="px-4 py-4 text-muted-foreground">{messages.cards.noCharges}</p>
              ) : (
                <StatementList cardId={card.id} currency={card.currency} locale={locale} messages={messages} statements={cardStatements} today={today} />
              )}
            </Card>
            {hasHistory ? (
              <Link className="inline-flex min-h-9 items-center gap-1 px-1 text-sm font-medium text-primary" href={`/${locale}/cards/${card.id}`}>
                {messages.cards.history}
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
