import { notFound } from "next/navigation";
import { z } from "zod";
import { IncomeForm } from "@/components/income-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { dateKeyOf } from "@/lib/months";
import { getActiveIncomeSources, getOwnedIncome } from "@/lib/queries";
import { todayKey } from "@/lib/today";

export default async function EditIncomePage({ params }: PageProps<"/[locale]/edit/income/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  if (!z.uuid().safeParse(id).success) notFound();

  const [income, sources] = await Promise.all([getOwnedIncome(userId, id), getActiveIncomeSources(userId)]);
  if (!income) notFound();
  const messages = getDictionary(locale);

  // Keep the entry's own source selectable even if it has since been removed from the list.
  const sourceOptions = sources.some((source) => source.id === income.source.id) ? sources : [...sources, income.source];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">{messages.edit.incomeTitle}</h1>
      <IncomeForm
        initial={{ id: income.id, amount: (income.amountCents / 100).toFixed(2), sourceId: income.source.id, date: dateKeyOf(income.date), note: income.note ?? "" }}
        locale={locale}
        messages={messages}
        sources={sourceOptions}
        today={todayKey()}
      />
    </div>
  );
}
