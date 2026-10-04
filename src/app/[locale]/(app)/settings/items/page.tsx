import { archiveItem, restoreItem } from "@/app/actions/items";
import { ActionButton } from "@/components/action-button";
import { DeleteButton } from "@/components/delete-button";
import { ItemEditForm, ItemMergeForm } from "@/components/item-forms";
import { Card, Section } from "@/components/section";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { getCategoriesForManagement, getItemsWithUsage } from "@/lib/queries";
import { RotateCcw } from "lucide-react";

export default async function ItemsPage({ params }: PageProps<"/[locale]/settings/items">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const [items, categories] = await Promise.all([getItemsWithUsage(userId), getCategoriesForManagement(userId)]);
  const activeItems = items.filter((item) => !item.archivedAt);
  const archivedItems = items.filter((item) => item.archivedAt);
  const categoryOptions = categories.filter((category) => !category.archivedAt).map((category) => ({ id: category.id, label: categoryLabel(category, messages.categories) }));
  const groups = categories
    .map((category) => ({ category, items: activeItems.filter((item) => item.categoryId === category.id) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-semibold">{messages.manage.items}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messages.manage.itemsDescription}</p>
      </div>

      {groups.length === 0 ? <Card className="px-4 py-6 text-center text-muted-foreground">{messages.manage.itemsEmpty}</Card> : null}

      {groups.map(({ category, items: groupItems }) => (
        <Section key={category.id} title={categoryLabel(category, messages.categories)}>
          <Card>
            <ul className="divide-y divide-border">
              {groupItems.map((item) => (
                <li key={item.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <p className="min-w-0 flex-1 truncate font-medium">{item.name}</p>
                      <span className="text-sm text-muted-foreground">{format(messages.manage.itemUses, { count: item._count.purchases + item._count.recurringPayments })}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <ItemEditForm categories={categoryOptions} item={item} locale={locale} messages={messages} />
                      <ItemMergeForm
                        item={item}
                        locale={locale}
                        messages={messages}
                        targets={activeItems.filter((other) => other.id !== item.id).map((other) => ({ id: other.id, name: other.name }))}
                      />
                      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                        {messages.manage.archiveItem}
                        <DeleteButton action={archiveItem} confirmMessage={messages.manage.confirmArchiveItem} id={item.id} label={messages.manage.archiveItem} locale={locale} />
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ))}

      {archivedItems.length > 0 ? (
        <Section title={messages.manage.archivedItems}>
          <Card>
            <ul className="divide-y divide-border">
              {archivedItems.map((item) => (
                <li className="flex items-center gap-3 py-2 pl-4 pr-2 text-muted-foreground" key={item.id}>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <ActionButton action={restoreItem} fields={{ id: item.id, locale }} label={messages.manage.restore}>
                    <RotateCcw aria-hidden="true" className="size-4" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
