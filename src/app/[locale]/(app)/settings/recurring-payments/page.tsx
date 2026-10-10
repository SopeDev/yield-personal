import { stopRecurringPayment } from "@/app/actions/recurring";
import { DeleteButton } from "@/components/delete-button";
import { Money } from "@/components/money";
import { RecurringForm } from "@/components/recurring-form";
import { Card, Section } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { formatMonth } from "@/lib/dates";
import { getRecurringDefinitions } from "@/lib/ledger-data";
import { monthKeyOf } from "@/lib/months";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getActivePaymentMethods, getActiveCategories, getActiveItems } from "@/lib/queries";
import { currentMonthKey } from "@/lib/today";

/** Bills that repeat: add, edit (from this month on), and stop them; stopped ones are listed below. */
export default async function RecurringPaymentsPage({ params }: PageProps<"/[locale]/settings/recurring-payments">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();

  const [definitions, items, categories, methods] = await Promise.all([
    getRecurringDefinitions(userId),
    getActiveItems(userId),
    getActiveCategories(userId),
    getActivePaymentMethods(userId),
  ]);
  const categoryOptions = categories.map((category) => ({ id: category.id, key: category.key, label: categoryLabel(category, messages.categories) }));
  const methodOptions = methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color }));
  const active = definitions.filter((definition) => !definition.endMonth || monthKeyOf(definition.endMonth) >= currentMonth);
  const ended = definitions.filter((definition) => definition.endMonth && monthKeyOf(definition.endMonth) < currentMonth);

  return (
    <div className="space-y-7">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} description={messages.recurring.description} title={messages.recurring.title} />

      <Card>
        {active.length === 0 ? (
          <p className="px-4 py-4 text-muted-foreground">{messages.recurring.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((definition) => {
              const schedule = definition.intervalMonths > 1 ? format(messages.recurring.everyMonths, { months: definition.intervalMonths }) : null;
              return (
                <li key={definition.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-4">
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: definition.paymentMethod.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{definition.item.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[
                            categoryLabel(definition.item.category, messages.categories),
                            format(messages.recurring.summary, { day: definition.dayOfMonth, method: paymentMethodLabel(definition.paymentMethod, messages.common.cash) }),
                            schedule,
                            definition.isVariable ? messages.recurring.varies : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={definition.isVariable ? "text-muted-foreground" : undefined}>
                        {definition.isVariable ? "≈ " : ""}<Money cents={definition.amountCents} currency={definition.paymentMethod.currency} />
                      </span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <RecurringForm
                        categories={categoryOptions}
                        currentMonth={currentMonth}
                        initial={{
                          id: definition.id,
                          itemName: definition.item.name,
                          amount: (definition.amountCents / 100).toFixed(2),
                          dayOfMonth: definition.dayOfMonth,
                          paymentMethodId: definition.paymentMethod.id,
                          isVariable: definition.isVariable,
                          intervalMonths: definition.intervalMonths,
                        }}
                        items={items}
                        locale={locale}
                        messages={messages}
                        methods={methodOptions}
                      />
                      <div className="flex items-center justify-end gap-2 px-4 pb-4 text-sm text-muted-foreground">
                        {messages.recurring.stop}
                        <DeleteButton action={stopRecurringPayment} confirmMessage={messages.recurring.confirmStop} id={definition.id} label={messages.recurring.stop} locale={locale} />
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        <details className="border-t border-border" open={active.length === 0}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.recurring.add}</summary>
          <RecurringForm
            categories={categoryOptions}
            currentMonth={currentMonth}
            items={items}
            locale={locale}
            messages={messages}
            methods={methodOptions}
          />
        </details>
      </Card>

      {ended.length > 0 ? (
        <Section title={messages.recurring.stoppedTitle}>
          <Card>
            <ul className="divide-y divide-border">
              {ended.map((definition) => (
                <li className="flex items-center justify-between gap-3 px-4 py-3 text-muted-foreground" key={definition.id}>
                  <span className="truncate">{definition.item.name}</span>
                  <span className="text-sm">{format(messages.recurring.ended, { month: formatMonth(monthKeyOf(definition.endMonth!), locale) })}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
