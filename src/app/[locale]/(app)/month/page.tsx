import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { deleteExchange, deleteIncome, deletePurchase } from "@/app/actions/entries";
import { setOccurrencePaid } from "@/app/actions/recurring";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { StatementRow } from "@/components/statement-row";
import { SummaryCard } from "@/components/summary-card";
import { formatCentsIn } from "@/lib/money";
import { MonthNav } from "@/components/month-nav";
import { OccurrenceAmountForm } from "@/components/occurrence-amount-form";
import { PaidCheck, PaidCheckForm, StatusBadge } from "@/components/paid-toggle";
import { ReceiveIncomeForm } from "@/components/receive-income-form";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { occurrencePaymentStatus } from "@/lib/cash-flow";
import { categoryLabel } from "@/lib/categories";
import { daysBetween, formatDayHeading, formatShortDate, groupByDay } from "@/lib/dates";
import { dateFromKey, dateKeyOf } from "@/lib/months";
import type { LedgerIncome, LedgerPaymentMethod, MonthSpendingEntry } from "@/lib/ledger";
import { paymentMethodLabel } from "@/lib/payment-methods";
import type { RecurringOccurrence } from "@/lib/recurring";
import type { ExpectedPayday } from "@/lib/recurring-income";
import { loadCardSettings, loadMonthView, summaryCardFor } from "@/lib/month-view";
import { getActivePaymentMethods } from "@/lib/queries";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

type Exchange = Awaited<ReturnType<typeof loadMonthView>>["lists"]["exchanges"][number];
type DayItem =
  | { kind: "purchase"; entry: MonthSpendingEntry; date: Date }
  | { kind: "income"; income: LedgerIncome; date: Date }
  | { kind: "exchange"; exchange: Exchange; date: Date };

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
  const [view, methods, cardSettings] = await Promise.all([
    loadMonthView(userId, month, currentMonth),
    getActivePaymentMethods(userId),
    loadCardSettings(userId, "month"),
  ]);

  // Listed in every currency; the summary card and By category are the main currency's.
  const { cards, statements, spending, lists: { entries, incomes, occurrences, statementsClosing, carriedStatements, carriedOccurrences, exchanges, expectedPaydays } } = view;
  const statementCards = new Map(cards.map((card) => [card.id, card]));
  // Active methods to move a month's bill to, plus its current one if since archived.
  // A bill moves only between methods in its own currency: amounts are never converted.
  const methodOptions = methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color, isCard: method.kind === "CARD", currency: method.currency }));
  const methodOptionsFor = (current: LedgerPaymentMethod) => {
    const sameCurrency = methodOptions.filter((option) => option.currency === (current.currency ?? view.currency));
    return sameCurrency.some((option) => option.id === current.id)
      ? sameCurrency
      : [...sameCurrency, { id: current.id, label: paymentMethodLabel(current, messages.common.cash), color: current.color, isCard: current.kind === "CARD", currency: current.currency ?? view.currency }];
  };
  const toggleLabels = { paid: messages.common.paid, markPaid: messages.common.markPaid, markUnpaid: messages.common.markUnpaid };

  // Installments of purchases made in earlier months are listed apart from this month's days.
  const visibleEntries = itemFilter ? entries.filter((entry) => entry.purchase.item.id === itemFilter) : entries;
  const visibleOccurrences = itemFilter ? occurrences.filter((occurrence) => occurrence.recurring.item.id === itemFilter) : occurrences;
  const filteredItemName = visibleEntries[0]?.purchase.item.name ?? visibleOccurrences[0]?.recurring.item.name;
  const carriedInstallments = visibleEntries.filter((entry) => entry.installmentNumber > 1);
  const dayItems: DayItem[] = [
    ...visibleEntries.filter((entry) => entry.installmentNumber === 1).map((entry) => ({ kind: "purchase" as const, entry, date: entry.purchase.date })),
    ...(itemFilter ? [] : incomes).map((item) => ({ kind: "income" as const, income: item, date: item.date })),
    ...(itemFilter ? [] : exchanges).map((exchange) => ({ kind: "exchange" as const, exchange, date: exchange.date })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const today = todayKey();
  const summary = summaryCardFor("month", { view, today, ...cardSettings });

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
        currency={purchase.paymentMethod.currency}
        details={details}
        href={`/${locale}/edit/purchase/${purchase.id}`}
        key={purchase.id}
        title={purchase.item.name}
        trailing={<DeleteButton action={deletePurchase} confirmMessage={messages.month.confirmDeletePurchase} id={purchase.id} label={messages.common.delete} locale={locale} />}
      />
    );
  }

  /**
   * A recurring payment's month, dated by what happens that day: a cash bill is due (yellow 1–2 days before,
   * red on the day and after, until paid); a card bill is charged to the card, which its statement then pays.
   * The dot shows the payment method: green for cash, the card's color otherwise.
   */
  const occurrenceRow = (occurrence: RecurringOccurrence) => {
    const { recurring } = occurrence;
    const status = occurrencePaymentStatus(occurrence, statements);
    let dateLine: { text: string; tone?: string };
    if (recurring.paymentMethod.kind === "CARD") {
      const charged = dateKeyOf(occurrence.chargeDate) <= today;
      dateLine = { text: format(charged ? messages.month.charged : messages.month.charges, { date: formatShortDate(occurrence.chargeDate, locale) }) };
    } else {
      const daysUntilDue = daysBetween(today, dateKeyOf(occurrence.date));
      dateLine = {
        text: format(messages.cards.due, { date: formatShortDate(occurrence.date, locale) }),
        tone: status.paid ? undefined : daysUntilDue <= 0 ? "text-loss" : daysUntilDue < 3 ? "text-warning" : undefined,
      };
    }
    const subtitleParts: ReactNode[] = [
      <span className={cn(dateLine.tone && "font-medium", dateLine.tone)} key="date">{dateLine.text}</span>,
      occurrence.amountChanged ? messages.month.changedAmount : null,
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
                <span className="font-mono tabular-nums">≈ {formatCentsIn(occurrence.amountCents, recurring.paymentMethod.currency ?? view.currency, view.currency)}</span>
                <StatusBadge labels={messages.common} paid={status.paid} />
              </>
            ) : (
              <>
                <Money cents={occurrence.amountCents} currency={recurring.paymentMethod.currency} />
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

  /**
   * A recurring income's payday: received (with what arrived), or expected (yellow once the day has passed). In the
   * current month an expected one opens to record what arrived; later months only list them.
   */
  const paydayRow = ({ recurring, date, received }: ExpectedPayday) => {
    const key = `${recurring.id}-${date}`;
    const dot = <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-gain" />;
    if (received) {
      return (
        <li className="flex items-center gap-3 py-3 pl-4 pr-3" key={key}>
          {dot}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{recurring.source.name}</p>
            <p className="truncate text-sm text-muted-foreground">{format(messages.month.receivedOn, { date: formatShortDate(received.date, locale) })}</p>
          </div>
          <Money cents={received.amountCents} currency={recurring.currency} />
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{messages.month.received}</span>
        </li>
      );
    }
    const header = (
      <>
        {dot}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{recurring.source.name}</p>
          <p className={cn("truncate text-sm text-muted-foreground", date < today && "font-medium text-warning")}>
            {format(messages.month.expectedOn, { date: formatShortDate(dateFromKey(date), locale) })}
          </p>
        </div>
        <Money cents={recurring.amountCents} className="text-muted-foreground" currency={recurring.currency} />
      </>
    );
    if (month !== currentMonth) return <li className="flex items-center gap-3 py-3 pl-4 pr-3" key={key}>{header}</li>;
    return (
      <li key={key}>
        <details>
          <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-3">{header}</summary>
          <ReceiveIncomeForm amount={(recurring.amountCents / 100).toFixed(2)} locale={locale} messages={messages} payday={date} recurringIncomeId={recurring.id} />
        </details>
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

      <SummaryCard context={summary.context} customizeHref={`/${locale}/settings/cards/month`} layout={summary.layout} locale={locale} messages={messages} />

      {carriedStatements.length > 0 || carriedOccurrences.length > 0 ? (
        <Section title={messages.month.carriedTitle}>
          <Card className="border-loss/40">
            <ul className="divide-y divide-border">
              {carriedOccurrences.map((occurrence) => occurrenceRow(occurrence))}
              {carriedStatements.map((statement) => (
                <StatementRow card={statementCards.get(statement.paymentMethodId)} key={`${statement.paymentMethodId}-${statement.month}`} locale={locale} messages={messages} statement={statement} today={today} />
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      {itemFilter && visibleOccurrences.length === 0 ? null : (
        <Section action={<Link className="text-sm font-medium text-primary" href={`/${locale}/settings/recurring-payments`}>{messages.common.manage}</Link>} title={messages.month.recurring}>
          {visibleOccurrences.length === 0 ? (
            <Card className="px-4 py-6 text-center">
              <p className="text-muted-foreground">{messages.month.recurringEmpty}</p>
              <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary" href={`/${locale}/settings/recurring-payments`}>{messages.month.addRecurring}</Link>
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

      {/* Paydays matter only while the month is still to come; what was received is listed in the entries too. */}
      {!itemFilter && month >= currentMonth && expectedPaydays.length > 0 ? (
        <Section action={<Link className="text-sm font-medium text-primary" href={`/${locale}/settings/recurring-income`}>{messages.common.manage}</Link>} title={messages.month.expectedTitle}>
          <Card>
            <ul className="divide-y divide-border">{expectedPaydays.map(paydayRow)}</ul>
          </Card>
        </Section>
      ) : null}

      {statementsClosing.length > 0 ? (
        <Section title={messages.month.statements}>
          <Card>
            <ul className="divide-y divide-border">
              {statementsClosing.map((statement) => (
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
                      item.kind === "purchase" ? purchaseRow(item.entry) : item.kind === "exchange" ? (
                        <EntryRow
                          cents={item.exchange.toCents}
                          color="var(--color-muted-foreground)"
                          currency={item.exchange.toCurrency}
                          details={[
                            `${formatCentsIn(item.exchange.fromCents, item.exchange.fromCurrency, view.currency)} → ${formatCentsIn(item.exchange.toCents, item.exchange.toCurrency, view.currency)}`,
                            item.exchange.note,
                          ].filter(Boolean).join(" · ")}
                          key={item.exchange.id}
                          title={messages.add.exchangeTitle}
                          trailing={<DeleteButton action={deleteExchange} confirmMessage={messages.month.confirmDeleteExchange} id={item.exchange.id} label={messages.common.delete} locale={locale} />}
                        />
                      ) : (
                        <EntryRow
                          cents={item.income.amountCents}
                          currency={item.income.currency}
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
