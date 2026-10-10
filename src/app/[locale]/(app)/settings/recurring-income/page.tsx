import { stopRecurringIncome } from "@/app/actions/recurring-income";
import { DeleteButton } from "@/components/delete-button";
import { Money } from "@/components/money";
import { RecurringIncomeForm, type RecurringIncomeInitial } from "@/components/recurring-income-form";
import { Card } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { formatShortDate } from "@/lib/dates";
import { getRecurringIncomes } from "@/lib/ledger-data";
import { dateFromKey } from "@/lib/months";
import { getActiveIncomeSources, getActivePaymentMethods, getUserSettings, walletCurrencies } from "@/lib/queries";
import type { RecurringIncomeRhythm } from "@/lib/recurring-income";
import { todayKey } from "@/lib/today";

/** Income expected on a schedule: add, edit (for paydays not received yet), and stop it. */
export default async function RecurringIncomePage({ params }: PageProps<"/[locale]/settings/recurring-income">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const today = todayKey();

  const [recurringIncomes, sources, settings, methods] = await Promise.all([
    getRecurringIncomes(userId),
    getActiveIncomeSources(userId),
    getUserSettings(userId),
    getActivePaymentMethods(userId),
  ]);
  const currencies = walletCurrencies(settings.currency, methods);
  // A new recurring income starts from the income rhythm's schedule when it has paydays.
  const { rhythmParts } = settings;
  const newIncome: RecurringIncomeInitial = {
    kind: rhythmParts.kind === "DAILY" ? "MONTH_DAYS" : rhythmParts.kind,
    anchor: rhythmParts.anchor ?? today,
    days: rhythmParts.days,
  };
  const scheduleLabel = (rhythm: RecurringIncomeRhythm) => rhythm.kind === "MONTH_DAYS"
    ? format(messages.recurring.scheduleDays, { days: rhythm.days.join(", ") })
    : format(rhythm.kind === "WEEKLY" ? messages.recurring.scheduleWeekly : messages.recurring.scheduleBiweekly, { date: formatShortDate(dateFromKey(rhythm.anchor), locale) });

  return (
    <div className="space-y-7">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} description={messages.recurring.incomeDescription} title={messages.recurring.incomeTitle} />

      <Card>
        {recurringIncomes.length === 0 ? (
          <p className="px-4 py-4 text-muted-foreground">{messages.recurring.incomeEmpty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {recurringIncomes.map((recurring) => (
              <li key={recurring.id}>
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-4">
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-gain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{recurring.source.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{scheduleLabel(recurring.rhythm)}</p>
                    </div>
                    <Money cents={recurring.amountCents} currency={recurring.currency} />
                  </summary>
                  <div className="border-t border-border bg-background/40">
                    <RecurringIncomeForm
                      currencies={currencies}
                      initial={{
                        id: recurring.id,
                        sourceId: recurring.source.id,
                        amount: (recurring.amountCents / 100).toFixed(2),
                        currency: recurring.currency,
                        kind: recurring.rhythm.kind,
                        anchor: recurring.rhythm.kind === "MONTH_DAYS" ? today : recurring.rhythm.anchor,
                        days: recurring.rhythm.kind === "MONTH_DAYS" ? recurring.rhythm.days : [],
                      }}
                      locale={locale}
                      messages={messages}
                      // Its own source stays choosable even if since archived.
                      sources={sources.some((source) => source.id === recurring.source.id) ? sources : [...sources, recurring.source]}
                    />
                    <div className="flex items-center justify-end gap-2 px-4 pb-4 text-sm text-muted-foreground">
                      {messages.recurring.stop}
                      <DeleteButton action={stopRecurringIncome} confirmMessage={messages.recurring.confirmStopIncome} id={recurring.id} label={messages.recurring.stop} locale={locale} />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="border-t border-border">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.recurring.addIncome}</summary>
          <RecurringIncomeForm currencies={currencies} initial={newIncome} locale={locale} messages={messages} sources={sources} />
        </details>
      </Card>
    </div>
  );
}
