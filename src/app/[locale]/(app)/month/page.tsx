import Link from "next/link";
import { deleteIncome, deletePurchase } from "@/app/actions/entries";
import { setOccurrencePaid } from "@/app/actions/recurring";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { StatementRow } from "@/components/statement-row";
import { formatCents } from "@/lib/money";
import { MonthNav } from "@/components/month-nav";
import { OccurrenceAmountForm } from "@/components/occurrence-amount-form";
import { PaidToggle, StatusBadge } from "@/components/paid-toggle";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { occurrencePaymentStatus } from "@/lib/cash-flow";
import { categoryLabel } from "@/lib/categories";
import { formatDayHeading, formatShortDate, groupByDay } from "@/lib/dates";
import type { LedgerIncome, MonthSpendingEntry } from "@/lib/ledger";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { loadMonthView } from "@/lib/month-view";
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
  const { cards, entries, incomes, occurrences, statements, spending, income, cashFlow, estimatedCents } = await loadMonthView(userId, month, currentMonth);

  const balanceCents = income.totalCents - cashFlow.toPayCents;
  const statementCards = new Map(cards.map((card) => [card.id, card]));
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
        </div>
        <div className="grid grid-cols-2 divide-x divide-border text-center [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border">
          <Stat label={messages.month.spending}>
            <Money cents={spending.totalCents} />
            {estimatedCents > 0 ? (
              <span className="mt-0.5 block text-xs font-normal text-warning">{format(messages.month.includesEstimated, { amount: formatCents(estimatedCents) })}</span>
            ) : null}
          </Stat>
          <Stat label={messages.month.income}><Money cents={income.totalCents} /></Stat>
          <Stat label={messages.month.toPay}><Money cents={cashFlow.toPayCents} /></Stat>
          <Stat label={messages.month.outstanding}>
            <Money cents={cashFlow.outstandingCents} className={cashFlow.outstandingCents > 0 ? "text-warning" : undefined} />
            {cashFlow.carriedOutstandingCents > 0 ? (
              <span className="mt-0.5 block text-xs font-normal text-loss">{format(messages.month.includesCarried, { amount: formatCents(cashFlow.carriedOutstandingCents) })}</span>
            ) : null}
          </Stat>
        </div>
      </Card>

      {cashFlow.carriedStatements.length > 0 ? (
        <Section title={messages.month.carriedTitle}>
          <Card className="border-loss/40">
            <ul className="divide-y divide-border">
              {cashFlow.carriedStatements.map((statement) => (
                <StatementRow card={statementCards.get(statement.paymentMethodId)} key={`${statement.paymentMethodId}-${statement.month}`} locale={locale} messages={messages} statement={statement} today={today} />
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

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
                {visibleOccurrences.map((occurrence) => {
                  const { recurring } = occurrence;
                  const status = occurrencePaymentStatus(occurrence, statements);
                  const details = status.statement
                    ? format(messages.month.onStatement, { card: recurring.paymentMethod.name, date: formatShortDate(status.statement.dueDate, locale) })
                    : [format(messages.month.day, { day: occurrence.date.getUTCDate() }), paymentMethodLabel(recurring.paymentMethod, messages.common.cash)].join(" · ");
                  const subtitle = [details, occurrence.amountChanged ? messages.month.changedAmount : null, occurrence.estimated ? messages.month.estimate : null].filter(Boolean).join(" · ");
                  const amountForm = (mode: "change" | "confirm") => (
                    <OccurrenceAmountForm
                      amount={(occurrence.amountCents / 100).toFixed(2)}
                      isCash={recurring.paymentMethod.kind === "CASH"}
                      locale={locale}
                      messages={messages}
                      mode={mode}
                      month={month}
                      recurringPaymentId={recurring.id}
                    />
                  );
                  return (
                    <li key={recurring.id}>
                      {occurrence.estimated ? (
                        // An estimated variable bill needs its real amount: the confirm form is always shown.
                        <>
                          <div className="flex items-center gap-3 py-3 pl-4 pr-3">
                            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: recurring.paymentMethod.color }} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{recurring.item.name}</p>
                              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                            </div>
                            <span className="font-mono tabular-nums text-warning">≈ {formatCents(occurrence.amountCents)}</span>
                          </div>
                          {amountForm("confirm")}
                        </>
                      ) : (
                        <>
                          <details className="group">
                            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-3">
                              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: recurring.paymentMethod.color }} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{recurring.item.name}</p>
                                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                              </div>
                              <Money cents={occurrence.amountCents} />
                            </summary>
                            {amountForm("change")}
                          </details>
                          <div className="flex justify-end px-3 pb-3 -mt-1">
                            {recurring.paymentMethod.kind === "CASH" ? (
                              <PaidToggle action={setOccurrencePaid} fields={{ locale, recurringPaymentId: recurring.id, month }} labels={toggleLabels} paid={status.paid} />
                            ) : (
                              <StatusBadge labels={messages.common} paid={status.paid} />
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </Section>
      )}

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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium sm:text-base">{children}</p>
    </div>
  );
}
