import { archiveGoalFund, deleteSavingsMovement } from "@/app/actions/savings";
import { DeleteButton } from "@/components/delete-button";
import { InfoDialog } from "@/components/info-dialog";
import { Money } from "@/components/money";
import { EmergencyMonthsForm, GoalForm, SavingsMovementForm } from "@/components/savings-forms";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { formatDayHeading } from "@/lib/dates";
import { loadSavingsView } from "@/lib/month-view";
import { getActivePaymentMethods, getMainCurrency, walletCurrencies } from "@/lib/queries";
import { currentMonthKey, todayKey } from "@/lib/today";

const HISTORY_LIMIT = 20;

function Progress({ balanceCents, goalCents }: { balanceCents: number; goalCents: number }) {
  const percent = goalCents > 0 ? Math.min(100, Math.max(0, (balanceCents / goalCents) * 100)) : 0;
  return (
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default async function SavingsPage({ params }: PageProps<"/[locale]/savings">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const today = todayKey();

  const [{ average, installmentsOwedCents, movements, funds }, methods, mainCurrency] = await Promise.all([
    loadSavingsView(userId, currentMonthKey()), getActivePaymentMethods(userId), getMainCurrency(userId),
  ]);
  const currencies = walletCurrencies(mainCurrency, methods);
  const emergency = funds.find((fund) => fund.kind === "EMERGENCY");
  const goals = funds.filter((fund) => fund.kind === "GOAL");
  const fundLabel = (fund: (typeof funds)[number]) => (fund.kind === "EMERGENCY" ? messages.savings.emergencyFund : (fund.name ?? ""));
  const fundNames = new Map(funds.map((fund) => [fund.id, fundLabel(fund)]));

  const averageBreakdown = average.byCategory.length === 0 ? (
    <p className="px-4 py-4 text-muted-foreground">{messages.savings.averageEmpty}</p>
  ) : (
    <>
      <ul className="divide-y divide-border">
        {average.byCategory.map(({ category, averageCents, monthsWithData }) => (
          <li className="flex items-center justify-between gap-3 px-4 py-3" key={category.id}>
            <div>
              <p>{categoryLabel(category, messages.categories)}</p>
              <p className="text-xs text-muted-foreground">
                {monthsWithData === 1 ? messages.savings.monthsWithDataOne : format(messages.savings.monthsWithData, { months: monthsWithData })}
              </p>
            </div>
            <Money cents={averageCents} />
          </li>
        ))}
        <li className="flex items-center justify-between border-t border-border px-4 py-3 font-semibold">
          <span>{messages.savings.averageSpending}</span>
          <Money cents={average.totalCents} />
        </li>
      </ul>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{messages.savings.excludedNote}</p>
    </>
  );

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold">{messages.savings.title}</h1>

      {emergency ? (
        <Section title={messages.savings.emergencyFund}>
          <Card>
            <div className="space-y-3 px-4 py-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{messages.savings.balance}</p>
                  <Money cents={emergency.balanceCents} className="text-3xl text-gain" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{messages.savings.goal}</p>
                  <Money cents={emergency.goalCents} className="text-lg" />
                </div>
              </div>
              <Progress balanceCents={emergency.balanceCents} goalCents={emergency.goalCents} />
              <p className={cn("text-sm font-medium", emergency.pendingCents > 0 ? "text-warning" : "text-gain")}>
                {emergency.pendingCents > 0 ? <>{messages.savings.pending}: <Money cents={emergency.pendingCents} /></> : messages.savings.reached}
              </p>
            </div>
            <dl className="divide-y divide-border border-t border-border text-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <dt>
                  <InfoDialog closeLabel={messages.common.close} label={messages.savings.averageSpending} title={messages.savings.averageBreakdown}>
                    {averageBreakdown}
                  </InfoDialog>{" "}
                  <span className="text-muted-foreground">{format(messages.savings.timesMonths, { months: emergency.coverMonths })}</span>
                </dt>
                <dd><Money cents={emergency.emergencyCents} /></dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <dt>+ {messages.savings.installmentsOwed}</dt>
                <dd><Money cents={installmentsOwedCents} /></dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 font-semibold">
                <dt>= {messages.savings.goal}</dt>
                <dd><Money cents={emergency.goalCents} /></dd>
              </div>
            </dl>
            <details className="border-t border-border">
              <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium text-primary">{messages.savings.settings}</summary>
              <EmergencyMonthsForm coverMonths={emergency.coverMonths} fundId={emergency.id} locale={locale} messages={messages} />
            </details>
          </Card>
        </Section>
      ) : null}

      <Section title={messages.savings.move}>
        <Card>
          <SavingsMovementForm funds={funds.map((fund) => ({ id: fund.id, label: fundLabel(fund) }))} locale={locale} messages={messages} today={today} />
        </Card>
      </Section>

      <Section title={messages.savings.goals}>
        <Card>
          {goals.length > 0 ? (
            <ul className="divide-y divide-border">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <details>
                    <summary className="block cursor-pointer list-none space-y-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{goal.name}</p>
                        <p className="text-sm"><Money cents={goal.balanceCents} currency={goal.currency} /> <span className="text-muted-foreground">/ <Money cents={goal.goalCents} currency={goal.currency} /></span></p>
                      </div>
                      <Progress balanceCents={goal.balanceCents} goalCents={goal.goalCents} />
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <GoalForm initial={{ id: goal.id, name: goal.name ?? "", target: ((goal.targetCents ?? 0) / 100).toFixed(2) }} locale={locale} messages={messages} />
                      <div className="flex items-center justify-end gap-2 px-4 pb-4 text-sm text-muted-foreground">
                        {messages.savings.archiveGoal}
                        <DeleteButton action={archiveGoalFund} confirmMessage={messages.savings.confirmArchiveGoal} id={goal.id} label={messages.savings.archiveGoal} locale={locale} />
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : null}
          <details className={goals.length > 0 ? "border-t border-border" : undefined}>
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.savings.addGoal}</summary>
            <GoalForm currencies={currencies} locale={locale} messages={messages} />
          </details>
        </Card>
      </Section>

      <Section title={messages.savings.history}>
        <Card>
          {movements.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.savings.historyEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {movements.slice(0, HISTORY_LIMIT).map((movement) => (
                <li className="flex items-center gap-3 py-3 pl-4 pr-2" key={movement.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fundNames.get(movement.fundId)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[formatDayHeading(movement.date, today, locale, messages.common), movement.note].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Money cents={movement.amountCents} className={movement.amountCents > 0 ? "text-gain" : "text-loss"} currency={movement.currency} signed />
                  <DeleteButton action={deleteSavingsMovement} confirmMessage={messages.savings.confirmDelete} id={movement.id} label={messages.common.delete} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>
    </div>
  );
}
