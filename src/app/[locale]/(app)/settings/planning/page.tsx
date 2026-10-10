import { BalanceGoalForm } from "@/components/balance-goal-form";
import { HistoryStartForm } from "@/components/history-start-form";
import { IncomeRhythmForm } from "@/components/income-rhythm-form";
import { Card, Section } from "@/components/section";
import { LinkRow, SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getUserSettings } from "@/lib/queries";
import { todayKey } from "@/lib/today";

/** What shapes the month's figures: the balance goal, the income rhythm, where history starts, and the summary cards. */
export default async function PlanningSettingsPage({ params }: PageProps<"/[locale]/settings/planning">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const { balanceGoalCents: goalCents, historyStartMonth, rhythmParts } = await getUserSettings(userId);

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
