import Link from "next/link";
import { deleteIncome } from "@/app/actions/entries";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { MonthNav } from "@/components/month-nav";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { formatDayHeading, groupByDay } from "@/lib/dates";
import { loadMonthView } from "@/lib/month-view";
import { getActiveIncomeSources } from "@/lib/queries";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

export default async function IncomePage({ params, searchParams }: PageProps<"/[locale]/income">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const month = monthFromSearchParam((await searchParams).m, currentMonthKey());
  const messages = getDictionary(locale);

  const [{ incomes, spending, income }, sources] = await Promise.all([loadMonthView(userId, month), getActiveIncomeSources(userId)]);
  const hasRideshare = sources.some((source) => source.isRideshare) || income.rideshareGrossCents > 0;
  const today = todayKey();

  return (
    <div className="space-y-7">
      <MonthNav labels={messages.common} locale={locale} month={month} path={`/${locale}/income`} />

      <Card className="px-4 py-5 text-center">
        <p className="text-xs text-muted-foreground">{messages.income.total}</p>
        <Money cents={income.totalCents} className="mt-1 block text-3xl text-gain" />
      </Card>

      {hasRideshare ? (
        <Section title={messages.income.rideshare}>
          <Card>
            <dl className="divide-y divide-border">
              <Row label={messages.income.rideshareGross}><Money cents={income.rideshareGrossCents} /></Row>
              <Row label={messages.income.carSpending}><Money cents={-spending.carCents} className="text-muted-foreground" /></Row>
              <Row label={messages.income.rideshareNet} strong>
                <Money cents={income.netRideshareCents} className={cn(income.netRideshareCents < 0 ? "text-loss" : "text-gain")} />
              </Row>
            </dl>
          </Card>
        </Section>
      ) : null}

      {income.bySource.length > 0 ? (
        <Section title={messages.income.bySource}>
          <Card>
            <dl className="divide-y divide-border">
              {income.bySource.map(({ source, totalCents }) => (
                <Row key={source.id} label={source.name}><Money cents={totalCents} /></Row>
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
                        color="var(--color-gain)"
                        details={item.note ?? (item.source.isRideshare ? messages.settings.rideshareBadge : messages.month.income)}
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

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className={strong ? "font-semibold" : undefined}>{label}</dt>
      <dd className={strong ? "font-semibold" : undefined}>{children}</dd>
    </div>
  );
}
