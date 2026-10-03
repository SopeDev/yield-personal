import { stopRecurringPayment } from "@/app/actions/recurring";
import { DeleteButton } from "@/components/delete-button";
import { Money } from "@/components/money";
import { RecurringForm } from "@/components/recurring-form";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { formatMonth } from "@/lib/dates";
import { getRecurringDefinitions } from "@/lib/ledger-data";
import { monthKeyOf } from "@/lib/months";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getActivePaymentMethods, getCategories } from "@/lib/queries";
import { currentMonthKey } from "@/lib/today";

export default async function RecurringPage({ params }: PageProps<"/[locale]/recurring">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currentMonth = currentMonthKey();

  const [definitions, categories, methods] = await Promise.all([getRecurringDefinitions(userId), getCategories(userId), getActivePaymentMethods(userId)]);
  const active = definitions.filter((definition) => !definition.endMonth || monthKeyOf(definition.endMonth) >= currentMonth);
  const ended = definitions.filter((definition) => definition.endMonth && monthKeyOf(definition.endMonth) < currentMonth);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-semibold">{messages.recurring.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.recurring.description}</p>
      </div>

      <Card>
        {active.length === 0 ? (
          <p className="px-4 py-4 text-muted-foreground">{messages.recurring.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((definition) => (
              <li className="flex items-center gap-3 py-3 pl-4 pr-2" key={definition.id}>
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: definition.paymentMethod.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{definition.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[
                      categoryLabel(definition.category, messages.categories),
                      format(messages.recurring.summary, { day: definition.dayOfMonth, method: paymentMethodLabel(definition.paymentMethod, messages.common.cash) }),
                    ].join(" · ")}
                  </p>
                </div>
                <Money cents={definition.amountCents} />
                <DeleteButton action={stopRecurringPayment} confirmMessage={messages.recurring.confirmStop} id={definition.id} label={messages.recurring.stop} locale={locale} />
              </li>
            ))}
          </ul>
        )}
        <details className="border-t border-border" open={active.length === 0}>
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.recurring.add}</summary>
          <RecurringForm
            categories={categories.map((category) => ({ id: category.id, key: category.key, label: categoryLabel(category, messages.categories) }))}
            currentMonth={currentMonth}
            locale={locale}
            messages={messages}
            methods={methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color }))}
          />
        </details>
      </Card>

      {ended.length > 0 ? (
        <Section title={messages.recurring.stoppedTitle}>
          <Card>
            <ul className="divide-y divide-border">
              {ended.map((definition) => (
                <li className="flex items-center justify-between gap-3 px-4 py-3 text-muted-foreground" key={definition.id}>
                  <span className="truncate">{definition.name}</span>
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
