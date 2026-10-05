import Link from "next/link";
import { deleteIncome } from "@/app/actions/entries";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { MonthNav } from "@/components/month-nav";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { formatDayHeading, groupByDay } from "@/lib/dates";
import { loadMonthView } from "@/lib/month-view";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";

export default async function IncomePage({ params, searchParams }: PageProps<"/[locale]/income">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const month = monthFromSearchParam((await searchParams).m, currentMonthKey());
  const messages = getDictionary(locale);

  const { incomes, spending, income } = await loadMonthView(userId, month, currentMonthKey());
  const today = todayKey();

  return (
    <div className="space-y-7">
      <MonthNav labels={messages.common} locale={locale} month={month} path={`/${locale}/income`} />

      <Card>
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">{messages.income.total}</p>
          <Money cents={income.totalCents} className="mt-1 block text-3xl text-gain" />
          {income.daysWithIncome > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {income.daysWithIncome === 1 ? messages.income.daysWithIncomeOne : format(messages.income.daysWithIncome, { count: income.daysWithIncome })}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-center [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border">
          <Stat label={messages.income.carSpending}><Money cents={-spending.carCents} className="text-muted-foreground" /></Stat>
          <Stat label={messages.income.net}><Money cents={income.netCents} className={tone(income.netCents)} /></Stat>
          <Stat label={messages.income.dailyGross}><Money cents={income.dailyGrossCents} /></Stat>
          <Stat label={messages.income.dailyNet}><Money cents={income.dailyNetCents} className={tone(income.dailyNetCents)} /></Stat>
          {/* Rideshare figures differ from the totals only when there is other income too. */}
          {income.rideshareGrossCents > 0 && income.rideshareGrossCents < income.totalCents ? (
            <>
              <Stat label={messages.income.rideshareGross}><Money cents={income.rideshareGrossCents} /></Stat>
              <Stat label={messages.income.rideshareNet}><Money cents={income.netRideshareCents} className={tone(income.netRideshareCents)} /></Stat>
            </>
          ) : null}
        </div>
      </Card>

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

function tone(cents: number) {
  return cents < 0 ? "text-loss" : "text-gain";
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium sm:text-base">{children}</p>
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
