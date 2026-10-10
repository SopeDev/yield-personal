import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { archiveCategory, moveCategory, restoreCategory } from "@/app/actions/settings";
import { ActionButton } from "@/components/action-button";
import { CategoryForm } from "@/components/category-form";
import { Card } from "@/components/section";
import { RemoveRow, SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { getCategoriesForManagement } from "@/lib/queries";

/** Categories, with their types and order. */
export default async function CategoriesSettingsPage({ params }: PageProps<"/[locale]/settings/categories">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const allCategories = await getCategoriesForManagement(userId);
  const categories = allCategories.filter((category) => !category.archivedAt);
  const archivedCategories = allCategories.filter((category) => category.archivedAt);

  return (
    <div className="space-y-8">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} title={messages.manage.categories} />

      <Card>
        <ul className="divide-y divide-border">
          {categories.map((category, index) => (
            <li key={category.id}>
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(category, messages.categories)}</span>
                  {category.kind !== "EVERYDAY" ? <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{messages.manage[`kind${category.kind}`]}</span> : null}
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
                      kind: category.kind,
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
    </div>
  );
}
