import { archiveIncomeGroup, archiveIncomeSource } from "@/app/actions/settings";
import { IncomeGroupForm } from "@/components/income-group-form";
import { IncomeSourceForm } from "@/components/income-source-form";
import { Card, Section } from "@/components/section";
import { RemoveRow, SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { getActiveIncomeSources, getCategoriesForManagement, getIncomeGroupsForManagement } from "@/lib/queries";

/** Income sources, and income groups with the categories they deduct. */
export default async function IncomeSettingsPage({ params }: PageProps<"/[locale]/settings/income">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const [sources, groups, allCategories] = await Promise.all([
    getActiveIncomeSources(userId),
    getIncomeGroupsForManagement(userId),
    getCategoriesForManagement(userId),
  ]);
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  // A source may stay in a group archived since, so its own group is always offered.
  const groupsFor = (groupId: string | null) => {
    const own = groups.find((group) => group.id === groupId && group.archivedAt);
    return own ? [...activeGroups, own] : activeGroups;
  };
  const categoryNames = new Map(allCategories.map((category) => [category.id, categoryLabel(category, messages.categories)]));
  const categoryOptions = allCategories.filter((category) => !category.archivedAt).map((category) => ({ id: category.id, label: categoryLabel(category, messages.categories) }));

  return (
    <div className="space-y-8">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} title={messages.settings.sourcesAndGroups} />

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
                      {source.groupId && groupNames.has(source.groupId) ? (
                        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">{groupNames.get(source.groupId)}</span>
                      ) : null}
                      <span className="text-sm text-primary">{messages.common.edit}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <IncomeSourceForm groups={groupsFor(source.groupId)} initial={source} locale={locale} messages={messages} />
                      <RemoveRow action={archiveIncomeSource} confirmMessage={messages.settings.confirmRemove} id={source.id} label={messages.settings.remove} locale={locale} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addSource}</summary>
            <IncomeSourceForm groups={activeGroups} locale={locale} messages={messages} />
          </details>
        </Card>
      </Section>

      <Section title={messages.settings.incomeGroups}>
        <Card>
          <p className="px-4 pt-4 text-sm text-muted-foreground">{messages.settings.incomeGroupsHint}</p>
          {activeGroups.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.settings.groupsEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {activeGroups.map((group) => (
                <li key={group.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{group.name}</p>
                        {group.deductCategoryIds.length > 0 ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {messages.settings.deducts} {group.deductCategoryIds.map((id) => categoryNames.get(id)).filter(Boolean).join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm text-primary">{messages.common.edit}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <IncomeGroupForm categories={categoryOptions} initial={group} locale={locale} messages={messages} />
                      <RemoveRow action={archiveIncomeGroup} confirmMessage={messages.settings.confirmArchiveGroup} id={group.id} label={messages.settings.archiveGroup} locale={locale} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addGroup}</summary>
            <IncomeGroupForm categories={categoryOptions} locale={locale} messages={messages} />
          </details>
        </Card>
      </Section>
    </div>
  );
}
