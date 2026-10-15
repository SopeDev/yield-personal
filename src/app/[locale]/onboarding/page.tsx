import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getShellUser } from "@/lib/queries";
import { LOCALE_CURRENCY } from "@/lib/onboarding";
import { todayKey } from "@/lib/today";

/** The setup wizard a new account opens on, once: finishing or skipping it marks the account as set up. */
export default async function OnboardingPage({ params }: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const { onboarded } = await getShellUser(await requireUserId(locale));
  if (onboarded) redirect(`/${locale}/month`);

  return (
    <OnboardingWizard currency={LOCALE_CURRENCY[locale]} labels={getDictionary(locale).onboarding} locale={locale} save={completeOnboarding} today={todayKey()} />
  );
}

