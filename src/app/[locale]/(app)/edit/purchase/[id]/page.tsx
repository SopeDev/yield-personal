import { notFound } from "next/navigation";
import { z } from "zod";
import { ExpenseForm } from "@/components/expense-form";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { dateKeyOf } from "@/lib/months";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getActiveCategories, getActiveItems, getActivePaymentMethods, getOwnedPurchase } from "@/lib/queries";
import { todayKey } from "@/lib/today";

export default async function EditPurchasePage({ params }: PageProps<"/[locale]/edit/purchase/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  if (!z.uuid().safeParse(id).success) notFound();

  const [purchase, items, categories, methods] = await Promise.all([
    getOwnedPurchase(userId, id),
    getActiveItems(userId),
    getActiveCategories(userId),
    getActivePaymentMethods(userId),
  ]);
  if (!purchase) notFound();
  const messages = getDictionary(locale);

  // Keep the purchase's own payment method selectable even if that card has since been archived.
  const methodOptions = methods.some((method) => method.id === purchase.paymentMethodId) ? methods : [...methods, purchase.paymentMethod];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">{messages.edit.purchaseTitle}</h1>
      <ExpenseForm
        categories={categories.map((category) => ({ id: category.id, key: category.key, label: categoryLabel(category, messages.categories) }))}
        initial={{
          id: purchase.id,
          amount: (purchase.amountCents / 100).toFixed(2),
          itemName: purchase.item.name,
          paymentMethodId: purchase.paymentMethodId,
          installments: purchase.installmentCount,
          date: dateKeyOf(purchase.date),
          note: purchase.note ?? "",
        }}
        items={items}
        locale={locale}
        messages={messages}
        methods={methodOptions.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color, isCard: method.kind === "CARD", currency: method.currency }))}
        today={todayKey()}
      />
    </div>
  );
}
