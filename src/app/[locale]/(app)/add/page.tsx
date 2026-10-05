import { AddEntry } from "@/components/add-entry";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { getActiveIncomeSources, getActivePaymentMethods, getActiveCategories, getActiveItems, getUsualPurchases } from "@/lib/queries";
import { todayKey } from "@/lib/today";

export default async function AddPage({ params, searchParams }: PageProps<"/[locale]/add">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const type = (await searchParams).type === "income" ? "income" : "expense";
  const messages = getDictionary(locale);
  const today = todayKey();
  const [items, categories, methods, sources, usual] = await Promise.all([
    getActiveItems(userId),
    getActiveCategories(userId),
    getActivePaymentMethods(userId),
    getActiveIncomeSources(userId),
    getUsualPurchases(userId),
  ]);

  // Keyed by the URL's tab so navigating here (say, from the Add button) opens it fresh.
  return (
    <AddEntry
      expense={{
        items,
        categories: categories.map((category) => ({ id: category.id, key: category.key, label: categoryLabel(category, messages.categories) })),
        methods: methods.map((method) => ({ id: method.id, label: paymentMethodLabel(method, messages.common.cash), color: method.color, isCard: method.kind === "CARD" })),
        today,
        usual,
      }}
      income={{ sources, today }}
      initialType={type}
      key={type}
      locale={locale}
      messages={messages}
    />
  );
}
