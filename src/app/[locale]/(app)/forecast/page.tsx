import Link from "next/link";
import { ForecastChart, type ForecastChartDay } from "@/components/forecast-chart";
import { Money } from "@/components/money";
import { Card, Section } from "@/components/section";
import { isLocale, type Locale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { FORECAST_DAYS, FORECAST_SURE_DAYS, monthOfKey } from "@/lib/forecast";
import { formatCents } from "@/lib/money";
import { dateFromKey, daysInMonth } from "@/lib/months";
import { loadForecast } from "@/lib/month-view";
import { todayKey } from "@/lib/today";

const shortDate = (dateKey: string, locale: Locale) => formatShortDate(dateFromKey(dateKey), locale);

/**
 * Cash on hand over the next three months, day by day: where it's headed from today's cash at the recent pace of
 * income and spending, with bills, card statements and recurring income on their dates, its low point, and what's
 * coming up.
 */
export default async function ForecastPage({ params }: PageProps<"/[locale]/forecast">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const m = messages.forecast;
  const today = todayKey();
  const forecast = await loadForecast(userId, today);

  if (!forecast) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold">{m.title}</h1>
        <Card className="space-y-3 px-4 py-5">
          <p className="text-muted-foreground">{m.needsCash}</p>
          <Link className="font-medium text-primary" href={`/${locale}/settings/money`}>{m.countCash}</Link>
        </Card>
      </div>
    );
  }

  const { days, low, currency } = forecast;
  const lowIndex = days.findIndex((day) => day.date === low.date);
  const chartDays: ForecastChartDay[] = days.map((day) => ({
    label: day.date === today ? `${messages.common.today} · ${shortDate(day.date, locale)}` : shortDate(day.date, locale),
    cents: day.cents,
    events: day.events.map(({ label, cents, estimated, overdue }) => ({ label, cents, estimated, overdue })),
  }));
  const monthName = (dateKey: string) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(dateFromKey(dateKey)).replace(".", "");
  const ticks = days.flatMap((day, index) => (day.date.endsWith("-01") ? [{ index, label: monthName(day.date) }] : []));
  // The cash left at the end of each month the forecast reaches.
  const monthEnds = days.filter((day) => Number(day.date.slice(8)) === daysInMonth(monthOfKey(day.date)));
  const upcoming = days.filter((day) => day.events.length > 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-muted-foreground">{format(m.subtitle, { days: FORECAST_DAYS })}</p>
      </div>

      <Card className="divide-y divide-border">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground">{m.cashNow}</p>
            <Money cents={forecast.startCents} className={cn("text-lg font-semibold", forecast.startCents < 0 ? "text-loss" : "text-gain")} />
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground">{m.lowest}</p>
            <Money cents={low.cents} className={cn("text-lg font-semibold", low.cents < 0 ? "text-loss" : low.cents < forecast.startCents ? "text-warning" : "text-gain")} />
            <p className="text-xs text-muted-foreground">{low.date === today ? messages.common.today : shortDate(low.date, locale)}</p>
          </div>
        </div>
        <div className="px-4 pb-3 pt-4">
          <ForecastChart
            days={chartDays}
            labels={{ title: m.title, low: m.low, estimated: m.estimated, overdue: m.overdue, noEvents: m.noEvents }}
            lowIndex={lowIndex}
            sureDays={FORECAST_SURE_DAYS}
            ticks={ticks}
          />
        </div>
        {monthEnds.length > 0 ? (
          <dl className={cn("grid divide-x divide-border text-center", monthEnds.length === 3 ? "grid-cols-3" : monthEnds.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
            {monthEnds.slice(0, 3).map((day) => (
              <div className="px-2 py-3" key={day.date}>
                <dt className="text-xs text-muted-foreground">{format(m.endOf, { month: monthName(day.date) })}</dt>
                <dd><Money cents={day.cents} className={cn("text-sm font-medium", day.cents < 0 ? "text-loss" : "text-foreground")} /></dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Card>

      <Section title={m.upcoming}>
        <Card>
          {upcoming.length === 0 ? <p className="px-4 py-4 text-muted-foreground">{m.nothingUpcoming}</p> : (
            <ul className="divide-y divide-border">
              {upcoming.map((day) => (
                <li className="px-4 py-3" key={day.date}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{day.date === today ? messages.common.today : shortDate(day.date, locale)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.leaves} <Money cents={day.cents} className={cn("text-sm font-medium", day.cents < 0 ? "text-loss" : "text-foreground")} />
                    </p>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {day.events.map((event, index) => (
                      <li className="flex justify-between gap-3 text-sm" key={`${event.label}-${index}`}>
                        <span className="truncate text-muted-foreground">
                          {event.label}
                          {event.overdue ? <span className="ml-1 text-xs text-warning">· {m.overdue}</span> : event.estimated ? <span className="ml-1 text-xs text-subtle">· {m.estimated}</span> : null}
                        </span>
                        <Money cents={event.cents} className={event.cents < 0 ? undefined : "text-gain"} signed />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section title={m.howTitle}>
        <Card className="space-y-2 px-4 py-4 text-sm text-muted-foreground">
          <p>{format(m.how, {
            pace: formatCents(forecast.paceDailyCents, currency),
            spending: formatCents(forecast.cashDailyCents, currency),
            days: forecast.historyDays,
          })}</p>
          <p>{m.howCards}</p>
          <p>{format(m.howFaded, { days: FORECAST_SURE_DAYS })}</p>
        </Card>
      </Section>
    </div>
  );
}
