import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { signOut } from "@/auth";
import { archiveCard, archiveIncomeSource, setLocale } from "@/app/actions/settings";
import { CardForm } from "@/components/card-form";
import { DeleteButton } from "@/components/delete-button";
import { IncomeSourceForm } from "@/components/income-source-form";
import { Card, Section } from "@/components/section";
import { isLocale, locales } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getActiveIncomeSources, getActivePaymentMethods } from "@/lib/queries";
import { cn } from "@/lib/cn";

const languageNames = { en: "English", es: "Español" } as const;

export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const [methods, sources] = await Promise.all([getActivePaymentMethods(userId), getActiveIncomeSources(userId)]);
  const cards = methods.filter((method) => method.kind === "CARD");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold">{messages.settings.title}</h1>

      <Section title={messages.settings.language}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
          {locales.map((option) => (
            <form action={setLocale} key={option}>
              <input name="locale" type="hidden" value={option} />
              <button
                aria-pressed={option === locale}
                className={cn("flex min-h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition", option === locale ? "bg-background text-foreground" : "text-muted-foreground")}
                type="submit"
              >
                {languageNames[option]}
              </button>
            </form>
          ))}
        </div>
      </Section>

      <Link className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-surface px-4 font-medium" href={`/${locale}/recurring`}>
        {messages.settings.recurringLink}
        <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
      </Link>

      <Section title={messages.settings.cards}>
        <Card>
          {cards.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.settings.cardsEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {cards.map((card) => (
                <li className="flex items-center gap-3 py-3 pl-4 pr-2" key={card.id}>
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{card.name}</p>
                    <p className="text-sm text-muted-foreground">{format(messages.settings.cardDays, { closing: card.closingDay ?? "–", due: card.dueDay ?? "–" })}</p>
                  </div>
                  <DeleteButton action={archiveCard} confirmMessage={messages.settings.confirmRemove} id={card.id} label={messages.settings.remove} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addCard}</summary>
            <CardForm locale={locale} messages={messages} usedColors={cards.map((card) => card.color)} />
          </details>
        </Card>
      </Section>

      <Section title={messages.settings.incomeSources}>
        <Card>
          {sources.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.settings.sourcesEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {sources.map((source) => (
                <li className="flex items-center gap-3 py-3 pl-4 pr-2" key={source.id}>
                  <p className="min-w-0 flex-1 truncate font-medium">{source.name}</p>
                  {source.isRideshare ? <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">{messages.settings.rideshareBadge}</span> : null}
                  <DeleteButton action={archiveIncomeSource} confirmMessage={messages.settings.confirmRemove} id={source.id} label={messages.settings.remove} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addSource}</summary>
            <IncomeSourceForm locale={locale} messages={messages} />
          </details>
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
