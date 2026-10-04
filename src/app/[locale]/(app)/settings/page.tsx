import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp, RotateCcw } from "lucide-react";
import { signOut } from "@/auth";
import { archiveCard, archiveCategory, archiveIncomeSource, moveCategory, restoreCategory, setLocale } from "@/app/actions/settings";
import { ActionButton } from "@/components/action-button";
import { CategoryForm } from "@/components/category-form";
import { categoryLabel } from "@/lib/categories";
import { CardForm } from "@/components/card-form";
import { DeleteButton } from "@/components/delete-button";
import { IncomeSourceForm } from "@/components/income-source-form";
import { Card, Section } from "@/components/section";
import { isLocale, locales } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getActiveIncomeSources, getActivePaymentMethods, getCategoriesForManagement } from "@/lib/queries";
import { cn } from "@/lib/cn";

const languageNames = { en: "English", es: "Español" } as const;

export default async function SettingsPage({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const [methods, sources, allCategories] = await Promise.all([getActivePaymentMethods(userId), getActiveIncomeSources(userId), getCategoriesForManagement(userId)]);
  const categories = allCategories.filter((category) => !category.archivedAt);
  const archivedCategories = allCategories.filter((category) => category.archivedAt);
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

      <div className="space-y-2">
        <Link className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-surface px-4 font-medium" href={`/${locale}/recurring`}>
          {messages.settings.recurringLink}
          <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
        </Link>
        <Link className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-surface px-4 font-medium" href={`/${locale}/settings/items`}>
          {messages.manage.itemsLink}
          <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
        </Link>
      </div>

      <Section title={messages.manage.categories}>
        <Card>
          <ul className="divide-y divide-border">
            {categories.map((category, index) => (
              <li key={category.id}>
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(category, messages.categories)}</span>
                    {!category.includeInAverage ? <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{messages.manage.excludedBadge}</span> : null}
                    <span className="text-sm text-primary">{messages.common.edit}</span>
                  </summary>
                  <div className="border-t border-border bg-background/40">
                    <div className="flex items-center justify-end gap-1 px-2 pt-2">
                      <ActionButton action={moveCategory} disabled={index === 0} fields={{ id: category.id, direction: "up", locale }} label={messages.manage.moveUp}>
                        <ChevronUp aria-hidden="true" className="size-4" />
                      </ActionButton>
                      <ActionButton action={moveCategory} disabled={index === categories.length - 1} fields={{ id: category.id, direction: "down", locale }} label={messages.manage.moveDown}>
                        <ChevronDown aria-hidden="true" className="size-4" />
                      </ActionButton>
                    </div>
                    <CategoryForm
                      initial={{
                        id: category.id,
                        name: category.name ?? "",
                        defaultLabel: category.key ? categoryLabel({ key: category.key, name: null }, messages.categories) : null,
                        includeInAverage: category.includeInAverage,
                      }}
                      locale={locale}
                      messages={messages}
                    />
                    {categories.length > 1 ? (
                      <RemoveRow action={archiveCategory} confirmMessage={messages.manage.confirmArchiveCategory} id={category.id} label={messages.manage.archiveCategory} locale={locale} />
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.manage.addCategory}</summary>
            <CategoryForm locale={locale} messages={messages} />
          </details>
          {archivedCategories.length > 0 ? (
            <div className="border-t border-border">
              <p className="px-4 pt-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{messages.manage.archivedCategories}</p>
              <ul>
                {archivedCategories.map((category) => (
                  <li className="flex items-center gap-3 py-1 pl-4 pr-2 text-muted-foreground" key={category.id}>
                    <span className="min-w-0 flex-1 truncate">{categoryLabel(category, messages.categories)}</span>
                    <ActionButton action={restoreCategory} fields={{ id: category.id, locale }} label={messages.manage.restore}>
                      <RotateCcw aria-hidden="true" className="size-4" />
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title={messages.settings.cards}>
        <Card>
          {cards.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.settings.cardsEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {cards.map((card) => (
                <li key={card.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{card.name}</p>
                        <p className="text-sm text-muted-foreground">{format(messages.settings.cardDays, { closing: card.closingDay ?? "–", days: card.paymentDays ?? "–" })}</p>
                      </div>
                      <span className="text-sm text-primary">{messages.common.edit}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <CardForm
                        initial={{ id: card.id, name: card.name, color: card.color, closingDay: card.closingDay ?? 1, paymentDays: card.paymentDays ?? 15 }}
                        locale={locale}
                        messages={messages}
                        usedColors={cards.map((other) => other.color)}
                      />
                      <RemoveRow action={archiveCard} confirmMessage={messages.settings.confirmRemove} id={card.id} label={messages.settings.remove} locale={locale} />
                    </div>
                  </details>
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
                <li key={source.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <p className="min-w-0 flex-1 truncate font-medium">{source.name}</p>
                      {source.isRideshare ? <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">{messages.settings.rideshareBadge}</span> : null}
                      <span className="text-sm text-primary">{messages.common.edit}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <IncomeSourceForm initial={source} locale={locale} messages={messages} />
                      <RemoveRow action={archiveIncomeSource} confirmMessage={messages.settings.confirmRemove} id={source.id} label={messages.settings.remove} locale={locale} />
                    </div>
                  </details>
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

/** The remove or archive action shown under an edit form. */
function RemoveRow({ action, id, locale, label, confirmMessage }: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  locale: string;
  label: string;
  confirmMessage: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 px-4 pb-4 text-sm text-muted-foreground">
      {label}
      <DeleteButton action={action} confirmMessage={confirmMessage} id={id} label={label} locale={locale} />
    </div>
  );
}
