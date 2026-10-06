import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { deleteIncome, deletePurchase } from "@/app/actions/entries";
import { setOccurrencePaid } from "@/app/actions/recurring";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { StatementRow } from "@/components/statement-row";
import { formatCents } from "@/lib/money";
import { MonthNav } from "@/components/month-nav";
import { OccurrenceAmountForm } from "@/components/occurrence-amount-form";
import { PaidCheck, PaidCheckForm, StatusBadge } from "@/components/paid-toggle";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { occurrencePaymentStatus } from "@/lib/cash-flow";
import { categoryLabel } from "@/lib/categories";
import { daysBetween, formatDayHeading, formatMonth, formatShortDate, groupByDay } from "@/lib/dates";
import { dateKeyOf } from "@/lib/months";
import type { LedgerIncome, LedgerPaymentMethod, MonthSpendingEntry } from "@/lib/ledger";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { RecurringOccurrence } from "@/lib/recurring";
import { dailyNet, goalProgress, neededPerDay, typicalDailySpending } from "@/lib/daily-balance";
import { loadMonthView } from "@/lib/month-view";
import { getActivePaymentMethods, getUserSettings } from "@/lib/queries";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

type DayItem = { kind: "purchase"; entry: MonthSpendingEntry; date: Date } | { kind: "income"; income: LedgerIncome; date: Date };

export default async function MonthPage({ params, searchParams }: PageProps<"/[locale]/month">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const query = await searchParams;
  const currentMonth = currentMonthKey();
  const month = monthFromSearchParam(query.m, currentMonth);
  // Opening a cell of the year view filters the month's entries and recurring payments to one item.
  const itemFilter = typeof query.item === "string" ? query.item : null;
  const messages = getDictionary(locale);
  const [{ cards, entries, incomes, occurrences, statements, spending, income, cashFlow, savingsNetCents, purchases }, methods, { balanceGoalCents: goalCents, historyStartMonth }] = await Promise.all([
    loadMonthView(userId, month, currentMonth),
    getActivePaymentMethods(userId),
    getUserSettings(userId),
  ]);

  const balanceCents = income.totalCents - cashFlow.toPayCents;
  const statementCards = new Map(cards.map((card) => [card.id, card]));
  // Active methods to move a month's bill to, plus its current one if since archived.
  const methodOptions = methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color, isCard: method.kind === "CARD" }));
  const methodOptionsFor = (current: LedgerPaymentMethod) => methodOptions.some((option) => option.id === current.id)
    ? methodOptions
    : [...methodOptions, { id: current.id, label: paymentMethodLabel(current, messages.common.cash), color: current.color, isCard: current.kind === "CARD" }];
  const toggleLabels = { paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid };

  // Installments of purchases made in earlier months are listed apart from this month's days.
  const visibleEntries = itemFilter ? entries.filter((entry) => entry.purchase.item.id === itemFilter) : entries;
  const visibleOccurrences = itemFilter ? occurrences.filter((occurrence) => occurrence.recurring.item.id === itemFilter) : occurrences;
  const filteredItemName = visibleEntries[0]?.purchase.item.name ?? visibleOccurrences[0]?.recurring.item.name;
  const carriedInstallments = visibleEntries.filter((entry) => entry.installmentNumber > 1);
  const dayItems: DayItem[] = [
    ...visibleEntries.filter((entry) => entry.installmentNumber === 1).map((entry) => ({ kind: "purchase" as const, entry, date: entry.purchase.date })),
    ...(itemFilter ? [] : incomes).map((item) => ({ kind: "income" as const, income: item, date: item.date })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const today = todayKey();
  const dayNet = dailyNet({ month, today, entries, incomes });
  const typicalDay = typicalDailySpending({ purchases, today, historyStart: historyStartMonth });
  const needed = neededPerDay({
    month, today, toPayCents: cashFlow.toPayCents, incomeCents: income.totalCents, savingsNetCents, goalCents, typicalDailyCents: typicalDay.cents,
  });
  // Money moved into savings counts toward the goal; a month that has ended either met it or missed it.
  const goalLeftCents = goalCents === null ? 0 : goalCents - goalProgress({ balanceCents, savingsNetCents });
  const goalLine = goalCents === null ? null
    : goalLeftCents <= 0 ? { text: format(messages.month.goalReached, { goal: formatCents(goalCents) }), className: "text-gain" }
      : needed ? { text: format(messages.month.goalToGo, { goal: formatCents(goalCents), amount: formatCents(goalLeftCents) }), className: "text-muted-foreground" }
        : { text: format(messages.month.goalMissed, { goal: formatCents(goalCents), amount: formatCents(goalLeftCents) }), className: "text-loss" };

  function purchaseRow(entry: MonthSpendingEntry) {
    const { purchase } = entry;
    const details = [
      categoryLabel(purchase.item.category, messages.categories),
      paymentMethodLabel(purchase.paymentMethod, messages.common.cash),
      purchase.installmentCount > 1 ? format(messages.month.installment, { number: entry.installmentNumber, count: purchase.installmentCount }) : null,
      purchase.note,
    ].filter(Boolean).join(" · ");
    return (
      <EntryRow
        cents={entry.amountCents}
        color={purchase.paymentMethod.color}
        details={details}
        href={`/${locale}/edit/purchase/${purchase.id}`}
        key={purchase.id}
        title={purchase.item.name}
        trailing={<DeleteButton action={deletePurchase} confirmMessage={messages.month.confirmDeletePurchase} id={purchase.id} label={messages.common.delete} locale={locale} />}
      />
    );
  }

  /** A recurring payment's month; a carried one (an unpaid cash bill from an earlier month) also names its month. */
  const occurrenceRow = (occurrence: RecurringOccurrence, carried = false) => {
    const { recurring } = occurrence;
    const status = occurrencePaymentStatus(occurrence, statements);
    // An unpaid cash bill's day turns yellow within 3 days of it and red on the day or after.
    const daysUntilDue = daysBetween(today, dateKeyOf(occurrence.date));
    const dayTone = status.statement || status.paid ? undefined : daysUntilDue <= 0 ? "text-loss" : daysUntilDue < 3 ? "text-warning" : undefined;
    const subtitleParts: ReactNode[] = [
      ...(status.statement
        ? [format(messages.month.onStatement, { card: recurring.paymentMethod.name, date: formatShortDate(status.statement.dueDate, locale) })]
        : [
          carried ? formatMonth(occurrence.month, locale) : null,
          <span className={cn(dayTone && "font-medium", dayTone)} key="day">{format(messages.month.day, { day: occurrence.date.getUTCDate() })}</span>,
          paymentMethodLabel(recurring.paymentMethod, messages.common.cash),
        ]),
      occurrence.amountChanged ? messages.month.changedAmount : null,
      occurrence.estimated ? messages.month.estimate : null,
    ].filter(Boolean);
    const subtitle = subtitleParts.map((part, index) => <Fragment key={index}>{index > 0 ? " · " : null}{part}</Fragment>);
    const amountForm = (mode: "change" | "confirm") => (
      <OccurrenceAmountForm
        amount={(occurrence.amountCents / 100).toFixed(2)}
        locale={locale}
        messages={messages}
        methods={methodOptionsFor(recurring.paymentMethod)}
        mode={mode}
        month={occurrence.month}
        paymentMethodId={recurring.paymentMethod.id}
        recurringPaymentId={recurring.id}
      />
    );
    const paidFormId = `paid-${recurring.id}-${occurrence.month}`;
    return (
      <li key={`${recurring.id}-${occurrence.month}`}>
        {/* Tapping opens the amount and method; an estimated variable bill confirms them there, which also pays it. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-3">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: recurring.paymentMethod.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{recurring.item.name}</p>
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {occurrence.estimated ? (
              // Paid by confirming it, so it shows its status instead of a paid check.
              <>
                <span className="font-mono tabular-nums">≈ {formatCents(occurrence.amountCents)}</span>
                <StatusBadge labels={messages.common} paid={status.paid} />
              </>
            ) : (
              <>
                <Money cents={occurrence.amountCents} />
                {recurring.paymentMethod.kind === "CASH" ? (
                  <PaidCheck formId={paidFormId} labels={toggleLabels} paid={status.paid} />
                ) : (
                  <StatusBadge labels={messages.common} paid={status.paid} />
                )}
              </>
            )}
          </summary>
          {amountForm(occurrence.estimated ? "confirm" : "change")}
        </details>
        {!occurrence.estimated && recurring.paymentMethod.kind === "CASH" ? (
          <PaidCheckForm action={setOccurrencePaid} fields={{ locale, recurringPaymentId: recurring.id, month: occurrence.month }} id={paidFormId} paid={status.paid} />
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-7">
      <MonthNav labels={messages.common} locale={locale} month={month} path={`/${locale}/month`} />

      {itemFilter ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <span className="font-medium">{filteredItemName ? format(messages.year.filteredBy, { item: filteredItemName }) : messages.month.empty}</span>
          <Link className="shrink-0 font-semibold text-primary" href={`/${locale}/month?m=${month}`}>{messages.year.clearFilter}</Link>
        </div>
      ) : null}

      <Card>
        <div className="border-b border-border px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">{messages.month.balance}</p>
          <Money cents={balanceCents} className={cn("mt-1 block text-3xl", balanceCents < 0 ? "text-loss" : "text-gain")} />
          {goalLine ? <p className={cn("mt-1 text-xs", goalLine.className)}>{goalLine.text}</p> : null}
        </div>
        <div className="grid grid-cols-2 divide-x divide-border text-center [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border">
          <Stat label={messages.month.income}><Money cents={income.totalCents} /></Stat>
          <Stat label={messages.month.outstanding}>
            <Money cents={cashFlow.outstandingCents} className={cashFlow.outstandingCents > 0 ? "text-warning" : undefined} />
            {cashFlow.carriedOutstandingCents > 0 ? (
              <span className="mt-0.5 block text-xs font-normal text-loss">{format(messages.month.includesCarried, { amount: formatCents(cashFlow.carriedOutstandingCents) })}</span>
            ) : null}
          </Stat>
          <Stat label={messages.month.spending}><Money cents={spending.totalCents} /></Stat>
          <Stat label={messages.month.toPay}><Money cents={cashFlow.toPayCents} /></Stat>
          <Stat label={messages.month.neededPerDay}>
            {!needed ? <span className="text-subtle">–</span> : needed.forGoalCents === null ? (
              <>
                <Money cents={needed.cents} className={needed.cents === 0 ? "text-gain" : undefined} />
                {needed.typicalDailyCents > 0 ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{format(messages.month.inclEveryday, { amount: formatCents(needed.typicalDailyCents) })}</span>
                ) : null}
              </>
            ) : (
              // With a goal, the goal's daily target leads and breaking even is noted below.
              <>
                <Money cents={needed.forGoalCents} className={needed.forGoalCents === 0 ? "text-gain" : undefined} />
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{format(messages.month.breakEven, { amount: formatCents(needed.cents) })}</span>
              </>
            )}
          </Stat>
          <Stat label={messages.month.dailyNet}>
            {dayNet ? <Money cents={dayNet.averageCents} className={tone(dayNet.averageCents)} /> : <span className="text-subtle">–</span>}
          </Stat>
        </div>
      </Card>

      {cashFlow.carriedStatements.length > 0 || cashFlow.carriedOccurrences.length > 0 ? (
        <Section title={messages.month.carriedTitle}>
          <Card className="border-loss/40">
            <ul className="divide-y divide-border">
              {cashFlow.carriedOccurrences.map((occurrence) => occurrenceRow(occurrence, true))}
              {cashFlow.carriedStatements.map((statement) => (
                <StatementRow card={statementCards.get(statement.paymentMethodId)} key={`${statement.paymentMethodId}-${statement.month}`} locale={locale} messages={messages} statement={statement} today={today} />
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {itemFilter && visibleOccurrences.length === 0 ? null : (
        <Section action={<Link className="text-sm font-medium text-primary" href={`/${locale}/recurring`}>{messages.common.manage}</Link>} title={messages.month.recurring}>
          {visibleOccurrences.length === 0 ? (
            <Card className="px-4 py-6 text-center">
              <p className="text-muted-foreground">{messages.month.recurringEmpty}</p>
              <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary" href={`/${locale}/recurring`}>{messages.month.addRecurring}</Link>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {visibleOccurrences.map((occurrence) => occurrenceRow(occurrence))}
              </ul>
            </Card>
          )}
        </Section>
      )}

      {cashFlow.statementsClosing.length > 0 ? (
        <Section title={messages.month.statements}>
          <Card>
            <ul className="divide-y divide-border">
              {cashFlow.statementsClosing.map((statement) => (
                <StatementRow card={statementCards.get(statement.paymentMethodId)} key={`${statement.paymentMethodId}-${statement.month}`} locale={locale} messages={messages} statement={statement} today={today} />
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <Section title={messages.month.byCategory}>
        <Card>
          <ul className="divide-y divide-border">
            {spending.byCategory.map(({ category, totalCents }) => (
              <li className="flex items-center justify-between px-4 py-3" key={category.id}>
                <span>{categoryLabel(category, messages.categories)}</span>
                <Money cents={totalCents} className={totalCents === 0 ? "text-subtle" : undefined} />
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title={messages.month.entries}>
        {dayItems.length === 0 && carriedInstallments.length === 0 ? (
          <Card className="px-4 py-8 text-center">
            <p className="text-muted-foreground">{messages.month.empty}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/add`}>
              {messages.month.addFirst}
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupByDay(dayItems, (item) => item.date).map((day) => (
              <div key={day.date.toISOString()}>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{formatDayHeading(day.date, today, locale, messages.common)}</h3>
                <Card>
                  <ul className="divide-y divide-border">
                    {day.items.map((item) =>
                      item.kind === "purchase" ? purchaseRow(item.entry) : (
                        <EntryRow
                          cents={item.income.amountCents}
                          color="var(--color-gain)"
                          details={[messages.month.income, item.income.note].filter(Boolean).join(" · ")}
                          href={`/${locale}/edit/income/${item.income.id}`}
                          key={item.income.id}
                          signed
                          title={item.income.source.name}
                          trailing={<DeleteButton action={deleteIncome} confirmMessage={messages.month.confirmDeleteIncome} id={item.income.id} label={messages.common.delete} locale={locale} />}
                        />
                      ),
                    )}
                  </ul>
                </Card>
              </div>
            ))}
            {carriedInstallments.length > 0 ? (
              <div>
                <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{messages.add.installments}</h3>
                <Card><ul className="divide-y divide-border">{carriedInstallments.map(purchaseRow)}</ul></Card>
              </div>
            ) : null}
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
