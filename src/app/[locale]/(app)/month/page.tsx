import Link from "next/link";
import { deleteIncome, deletePurchase } from "@/app/actions/entries";
import { DeleteButton } from "@/components/delete-button";
import { EntryRow } from "@/components/entry-row";
import { Money } from "@/components/money";
import { MonthNav } from "@/components/month-nav";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { formatDayHeading, groupByDay } from "@/lib/dates";
import { monthSpendingEntries, summarizeIncome, summarizeSpending, type LedgerIncome, type MonthSpendingEntry } from "@/lib/ledger";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getCategories, getMonthIncomes, getPurchasesReachingMonth } from "@/lib/queries";
import { monthFromSearchParam } from "@/lib/search-params";
import { currentMonthKey, todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

type MonthItem = { kind: "purchase"; entry: MonthSpendingEntry; date: Date } | { kind: "income"; income: LedgerIncome; date: Date };

export default async function MonthPage({ params, searchParams }: PageProps<"/[locale]/month">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const month = monthFromSearchParam((await searchParams).m, currentMonthKey());
  const messages = getDictionary(locale);

  const [categories, purchases, incomes] = await Promise.all([
    getCategories(userId),
    getPurchasesReachingMonth(userId, month),
    getMonthIncomes(userId, month),
  ]);
  const entries = monthSpendingEntries(purchases, month);
  const spending = summarizeSpending(entries, categories);
  const income = summarizeIncome(incomes, spending.carCents);
  const balanceCents = income.totalCents - spending.totalCents;

  // Installments of purchases made in earlier months are listed apart from this month's days.
  const carriedInstallments = entries.filter((entry) => entry.installmentNumber > 1);
  const items: MonthItem[] = [
    ...entries.filter((entry) => entry.installmentNumber === 1).map((entry) => ({ kind: "purchase" as const, entry, date: entry.purchase.date })),
    ...incomes.map((item) => ({ kind: "income" as const, income: item, date: item.date })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const days = groupByDay(items, (item) => item.date);
  const today = todayKey();

  function purchaseRow(entry: MonthSpendingEntry) {
    const { purchase } = entry;
    const details = [
      categoryLabel(purchase.category, messages.categories),
      paymentMethodLabel(purchase.paymentMethod, messages.common.cash),
      purchase.installmentCount > 1 ? format(messages.month.installment, { number: entry.installmentNumber, count: purchase.installmentCount }) : null,
    ].filter(Boolean).join(" · ");
    return (
      <EntryRow
        cents={entry.amountCents}
        color={purchase.paymentMethod.color}
        details={details}
        key={purchase.id}
        title={purchase.description}
        trailing={<DeleteButton action={deletePurchase} confirmMessage={messages.month.confirmDeletePurchase} id={purchase.id} label={messages.common.delete} locale={locale} />}
      />
    );
  }

  return (
    <div className="space-y-7">
      <MonthNav labels={messages.common} locale={locale} month={month} path={`/${locale}/month`} />

      <Card className="grid grid-cols-3 divide-x divide-border text-center">
        <Stat label={messages.month.spending}><Money cents={spending.totalCents} /></Stat>
        <Stat label={messages.month.income}><Money cents={income.totalCents} /></Stat>
        <Stat label={messages.month.balance}><Money cents={balanceCents} className={cn(balanceCents < 0 ? "text-loss" : "text-gain")} /></Stat>
      </Card>

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
        {items.length === 0 && carriedInstallments.length === 0 ? (
          <Card className="px-4 py-8 text-center">
            <p className="text-muted-foreground">{messages.month.empty}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/add`}>
              {messages.month.addFirst}
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
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
    <div className="px-2 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium sm:text-base">{children}</p>
    </div>
  );
}
