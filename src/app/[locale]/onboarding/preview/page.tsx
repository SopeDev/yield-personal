import { notFound } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getOwnerEmail } from "@/lib/env";
import { getShellUser } from "@/lib/queries";
import { todayKey } from "@/lib/today";

/**
 * The setup wizard as a new account sees it, for the app's owner (`OWNER_EMAIL`) to go through at any time: the same
 * screens, but nothing is saved. Anyone else gets a 404.
 */
export default async function OnboardingPreviewPage({ params }: PageProps<"/[locale]/onboarding/preview">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const { currency, email } = await getShellUser(await requireUserId(locale));
  const owner = getOwnerEmail();
  if (!owner || email?.toLowerCase() !== owner) notFound();

  return <OnboardingWizard basePath="onboarding/preview" currency={currency} labels={getDictionary(locale).onboarding} locale={locale} today={todayKey()} />;
}
