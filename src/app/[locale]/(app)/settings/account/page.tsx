import { DeleteAccountForm } from "@/components/delete-account-form";
import { Card } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";

/** Deleting the account: what goes with it, and the confirmation. */
export default async function DeleteAccountPage({ params }: PageProps<"/[locale]/settings/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  await requireUserId(locale);
  const messages = getDictionary(locale);
  return (
    <div className="space-y-6">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} description={messages.account.body} title={messages.account.title} />
      <Card className="border-loss/40">
        <DeleteAccountForm labels={messages.account} locale={locale} />
      </Card>
    </div>
  );
}
