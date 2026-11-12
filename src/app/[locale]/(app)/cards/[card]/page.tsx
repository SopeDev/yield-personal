import { notFound } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { StatementList } from "@/components/statement-list";
import { db } from "@/db/client";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { loadLedgerRange } from "@/lib/ledger-data";
import { addMonths, dateKeyOf, monthKeyOf, type MonthKey } from "@/lib/months";
import { currentMonthKey, todayKey } from "@/lib/today";

/** How far back a card's history goes at most, whatever its first charge. */
const MAX_HISTORY_MONTHS = 120;

/** A card's history: every statement that has closed, newest first, since its first charge. */
export default async function CardHistoryPage({ params }: PageProps<"/[locale]/cards/[card]">) {
  const { locale, card: cardId } = await params;
  if (!isLocale(locale)) return null;
  if (!z.uuid().safeParse(cardId).success) notFound();
  const userId = await requireUserId(locale);
  const currentMonth = currentMonthKey();
  const today = todayKey();

  // Its first charge: the oldest purchase on it or the start of a recurring bill charged to it.
  const [firstPurchase, firstRecurring] = await Promise.all([
    db.purchase.findFirst({ where: { userId, paymentMethodId: cardId }, select: { date: true }, orderBy: { date: "asc" } }),
    db.recurringPayment.findFirst({ where: { userId, paymentMethodId: cardId }, select: { startMonth: true }, orderBy: { startMonth: "asc" } }),
  ]);
  const earliest = [firstPurchase?.date, firstRecurring?.startMonth].filter((date): date is Date => !!date).map((date) => monthKeyOf(date)).sort()[0] as MonthKey | undefined;
  const limit = addMonths(currentMonth, -MAX_HISTORY_MONTHS);
  const from = earliest && earliest > limit ? earliest : limit;

  const { data: { statements }, cards } = await loadLedgerRange(userId, currentMonth, currentMonth, { statementsFrom: from });
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) notFound();
  const messages = getDictionary(locale);
  const closed = statements
    .filter((statement) => statement.paymentMethodId === card.id && dateKeyOf(statement.closingDate) < today)
    .reverse();

  return (
    <div className="space-y-6">
      <SubpageHeader backHref={`/${locale}/cards`} backLabel={messages.cards.title} description={messages.cards.historyHint} title={`${card.name} · ${messages.cards.history}`} />
      <Card>
        {closed.length === 0 ? <p className="px-4 py-4 text-muted-foreground">{messages.cards.noHistory}</p> : (
          <StatementList cardId={card.id} currency={card.currency} locale={locale} messages={messages} statements={closed} today={today} />
        )}
      </Card>
    </div>
  );
}
