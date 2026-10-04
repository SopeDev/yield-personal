import Link from "next/link";
import { ExpenseForm } from "@/components/expense-form";
import { IncomeForm } from "@/components/income-form";
import { Card } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getActiveIncomeSources, getActivePaymentMethods, getActiveCategories } from "@/lib/queries";
import { todayKey } from "@/lib/today";
import { cn } from "@/lib/cn";

export default async function AddPage({ params, searchParams }: PageProps<"/[locale]/add">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const type = (await searchParams).type === "income" ? "income" : "expense";
  const messages = getDictionary(locale);
  const today = todayKey();
  const [categories, methods, sources] = await Promise.all([
    getActiveCategories(userId),
    getActivePaymentMethods(userId),
    getActiveIncomeSources(userId),
  ]);

  const tabs = [
    { type: "expense", label: messages.add.expense },
    { type: "income", label: messages.add.income },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab) => (
          <Link
            aria-current={tab.type === type ? "page" : undefined}
            className={cn("flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold transition", tab.type === type ? "bg-background text-foreground" : "text-muted-foreground")}
            href={`/${locale}/add${tab.type === "income" ? "?type=income" : ""}`}
            key={tab.type}
            replace
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {type === "expense" ? (
        <ExpenseForm
          categories={categories.map((category) => ({ id: category.id, key: category.key, label: categoryLabel(category, messages.categories) }))}
          locale={locale}
          messages={messages}
          methods={methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color, isCard: method.kind === "CARD" }))}
          today={today}
        />
      ) : sources.length > 0 ? (
        <IncomeForm locale={locale} messages={messages} sources={sources} today={today} />
      ) : (
        <Card className="px-4 py-8 text-center">
          <p className="text-muted-foreground">{messages.add.noSources}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/settings`}>
            {messages.add.goToSettings}
          </Link>
        </Card>
      )}
    </div>
  );
}
