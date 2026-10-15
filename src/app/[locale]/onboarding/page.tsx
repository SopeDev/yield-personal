import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getActiveCategories, getShellUser } from "@/lib/queries";
import { categoryLabel, isEveryday } from "@/lib/categories";
import { todayKey } from "@/lib/today";

/** The setup wizard a new account opens on, once: finishing or skipping it marks the account as set up. */
export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const [{ currency, onboarded }, categories] = await Promise.all([getShellUser(userId), getActiveCategories(userId)]);
  if (onboarded) redirect(`/${locale}/month`);

  return (
    <OnboardingWizard basePath="onboarding" currency={currency} categories={everyday(categories, locale)} labels={getDictionary(locale).onboarding} locale={locale} save={completeOnboarding} today={todayKey()} />
  );
}

/** The everyday categories, the ones typical spending counts, to estimate. */
function everyday(categories: Awaited<ReturnType<typeof getActiveCategories>>, locale: Locale) {
  const labels = getDictionary(locale).categories;
  return categories.filter(isEveryday).map((category) => ({ id: category.id, label: categoryLabel(category, labels) }));
}
