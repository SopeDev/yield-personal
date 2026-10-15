import { BalanceGoalForm } from "@/components/balance-goal-form";
import { EstimatesForm } from "@/components/estimates-form";
import { HistoryStartForm } from "@/components/history-start-form";
import { IncomeRhythmForm } from "@/components/income-rhythm-form";
import { Card, Section } from "@/components/section";
import { LinkRow, SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel, isEveryday } from "@/lib/categories";
import { ESTIMATE_DAYS, historyWindow } from "@/lib/daily-balance";
import { getActiveCategories, getUserSettings } from "@/lib/queries";
import { todayKey } from "@/lib/today";

/** What shapes the month's figures: the balance goal, the income rhythm, where history starts, and the summary cards. */
export default async function PlanningSettingsPage({ params }: PageProps<"/[locale]/settings/planning">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const [{ balanceGoalCents: goalCents, historyStartMonth, historyFrom, rhythmParts, estimates }, categories] = await Promise.all([
    getUserSettings(userId),
    getActiveCategories(userId),
  ]);
  // The setup wizard's estimates, shown while they still count (under a month of history) or while any is set.
  const historyDays = historyWindow(todayKey(), historyFrom ?? historyStartMonth).days;
  const hasEstimates = estimates.spending.length > 0 || estimates.incomeMonthlyCents > 0;
  const amount = (cents: number | undefined) => (cents ? (cents / 100).toFixed(2) : null);

  return (
    <div className="space-y-8">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} title={messages.settings.groupPlanning} />

      <Section title={messages.settings.goal}>
        <Card>
          <BalanceGoalForm goal={goalCents === null ? null : (goalCents / 100).toFixed(2)} locale={locale} messages={messages} />
        </Card>
      </Section>

      <Section title={messages.settings.incomeRhythm}>
        <Card>
          <IncomeRhythmForm anchor={rhythmParts.anchor} days={rhythmParts.days} kind={rhythmParts.kind} locale={locale} messages={messages} today={todayKey()} />
        </Card>
      </Section>

      <Section title={messages.settings.history}>
        <Card>
          <HistoryStartForm locale={locale} messages={messages} month={historyStartMonth} />
        </Card>
      </Section>

      {historyDays < ESTIMATE_DAYS || hasEstimates ? (
        <Section title={messages.settings.estimates}>
          <Card>
            <EstimatesForm
              categories={categories.filter(isEveryday).map((category) => ({
                id: category.id,
                label: categoryLabel(category, messages.categories),
                estimate: amount(estimates.spending.find((estimate) => estimate.categoryId === category.id)?.monthlyCents),
              }))}
              incomeEstimate={amount(estimates.incomeMonthlyCents)}
              locale={locale}
              messages={messages}
            />
          </Card>
          {historyDays >= ESTIMATE_DAYS ? <p className="px-1 text-xs text-muted-foreground">{messages.settings.estimatesDone}</p> : null}
        </Section>
      ) : null}

      <Section title={messages.settings.summaryCards}>
        <Card>
          <ul className="divide-y divide-border">
            <LinkRow href={`/${locale}/settings/cards/month`} title={messages.summary.monthTitle} />
            <LinkRow href={`/${locale}/settings/cards/income`} title={messages.summary.incomeTitle} />
          </ul>
        </Card>
      </Section>
    </div>
  );
}
