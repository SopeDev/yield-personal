import { Banknote, Globe, HandCoins, List, Repeat, Tags, Target } from "lucide-react";
import { signOut } from "@/auth";
import { Card, Section } from "@/components/section";
import { LinkRow } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";

/**
 * Settings as a menu: setup pages first, then the lists kept for spending and income, each a single tap away and
 * loading only what it shows. Each row says what its page holds, so the menu itself reads nothing.
 */
export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  await requireUserId(locale);
  const messages = getDictionary(locale);
  const { settings } = messages;
  const href = (page: string) => `/${locale}/settings/${page}`;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold">{settings.title}</h1>

      <Card>
        <ul className="divide-y divide-border">
          <LinkRow hint={settings.generalHint} href={href("general")} icon={Globe} title={settings.groupGeneral} />
          <LinkRow hint={settings.moneyHint} href={href("money")} icon={Banknote} title={settings.groupMoney} />
          <LinkRow hint={settings.planningHint} href={href("planning")} icon={Target} title={settings.groupPlanning} />
        </ul>
      </Card>

      <Section title={settings.groupSpending}>
        <Card>
          <ul className="divide-y divide-border">
            <LinkRow hint={settings.categoriesHint} href={href("categories")} icon={Tags} title={messages.manage.categories} />
            <LinkRow hint={settings.itemsHint} href={href("items")} icon={List} title={messages.manage.itemsLink} />
            <LinkRow hint={settings.recurringPaymentsHint} href={href("recurring-payments")} icon={Repeat} title={settings.recurringLink} />
          </ul>
        </Card>
      </Section>

      <Section title={settings.groupIncome}>
        <Card>
          <ul className="divide-y divide-border">
            <LinkRow hint={settings.sourcesHint} href={href("income")} icon={HandCoins} title={settings.sourcesAndGroups} />
            <LinkRow hint={settings.recurringIncomeHint} href={href("recurring-income")} icon={Repeat} title={settings.recurringIncomeLink} />
          </ul>
        </Card>
      </Section>

      <form action={signOutAction}>
        <button className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border font-medium text-muted-foreground transition hover:text-foreground" type="submit">
          {messages.auth.signOut}
        </button>
      </form>
    </div>
  );
}
