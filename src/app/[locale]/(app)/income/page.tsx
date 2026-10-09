import Link from "next/link";
import { deleteIncome } from "@/app/actions/entries";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { MonthNav } from "@/components/month-nav";
import { Card, Section } from "@/components/section";
import { SummaryCard } from "@/components/summary-card";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { formatDayHeading, groupByDay } from "@/lib/dates";
import { loadCardSettings, loadMonthView, summaryCardFor } from "@/lib/month-view";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";

export default async function IncomePage({ params, searchParams }: PageProps<"/[locale]/income">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const month = monthFromSearchParam((await searchParams).m, currentMonthKey());
  const messages = getDictionary(locale);

  const [view, cardSettings] = await Promise.all([loadMonthView(userId, month, currentMonthKey()), loadCardSettings(userId, "income")]);
  // The card and source totals are the main currency's; income in other currencies is listed and totalled apart.
  const { income, lists: { incomes } } = view;
  const otherBySource = [...incomes.filter((item) => (item.currency ?? view.currency) !== view.currency)
    .reduce((totals, item) => {
      const key = `${item.source.id}:${item.currency}`;
      const current = totals.get(key) ?? { source: item.source, currency: item.currency ?? view.currency, totalCents: 0 };
      current.totalCents += item.amountCents;
      return totals.set(key, current);
    }, new Map<string, { source: (typeof incomes)[number]["source"]; currency: string; totalCents: number }>())
    .values()];
  const today = todayKey();
  const summary = summaryCardFor("income", { view, today, ...cardSettings });
  const groupNames = new Map(income.byGroup.map(({ group }) => [group.id, group.name]));

  return (
    <div className="space-y-7">
      <MonthNav labels={messages.common} locale={locale} month={month} path={`/${locale}/income`} />

      <SummaryCard context={summary.context} customizeHref={`/${locale}/settings/cards/income`} layout={summary.layout} messages={messages} />

      {income.bySource.length > 0 || otherBySource.length > 0 ? (
        <Section title={messages.income.bySource}>
          <Card>
            <dl className="divide-y divide-border">
              {income.bySource.map(({ source, totalCents }) => (
                <Row key={source.id} label={source.name}><Money cents={totalCents} /></Row>
              ))}
              {otherBySource.map(({ source, currency, totalCents }) => (
                <Row key={`${source.id}:${currency}`} label={`${source.name} · ${currency}`}><Money cents={totalCents} currency={currency} /></Row>
              ))}
            </dl>
          </Card>
        </Section>
      ) : null}

      <Section title={messages.income.log}>
        {incomes.length === 0 ? (
          <Card className="px-4 py-8 text-center">
            <p className="text-muted-foreground">{messages.income.empty}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/add?type=income`}>
              {messages.income.addFirst}
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupByDay(incomes, (item) => item.date).map((day) => (
              <div key={day.date.toISOString()}>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{formatDayHeading(day.date, today, locale, messages.common)}</h3>
                <Card>
                  <ul className="divide-y divide-border">
                    {day.items.map((item) => (
                      <EntryRow
                        cents={item.amountCents}
                        currency={item.currency}
                        color="var(--color-gain)"
                        details={item.note ?? (item.source.groupId ? groupNames.get(item.source.groupId) : undefined) ?? messages.month.income}
                        href={`/${locale}/edit/income/${item.id}`}
                        key={item.id}
                        signed
                        title={item.source.name}
                        trailing={<DeleteButton action={deleteIncome} confirmMessage={messages.month.confirmDeleteIncome} id={item.id} label={messages.common.delete} locale={locale} />}
                      />
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
