"use client";

import { useId, useState } from "react";
import { format, type Messages } from "@/i18n/dictionaries";
import { normalizeItemName } from "@/lib/items";
import { Chip, Field, inputClass } from "./form-controls";
import type { ErrorKey } from "@/i18n/dictionaries";

export type ItemOption = { id: string; name: string; categoryId: string };
export type CategoryOption = { id: string; key: string | null; label: string };

/**
 * Item entry: typing suggests existing items. A matching name reuses that item (and its category); a new name
 * asks for the category the new item belongs to.
 */
export function ItemField({ items, categories, defaultCategoryKey, messages, errors, autoFocus }: {
  items: ItemOption[];
  categories: CategoryOption[];
  defaultCategoryKey: string;
  messages: Messages;
  errors: { itemName?: ErrorKey; categoryId?: ErrorKey };
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [name, setName] = useState("");
  const match = name.trim() ? items.find((item) => normalizeItemName(item.name) === normalizeItemName(name)) : undefined;
  const matchCategory = match ? categories.find((category) => category.id === match.categoryId) : undefined;
  const defaultCategoryId = (categories.find((category) => category.key === defaultCategoryKey) ?? categories[0])?.id;

  return (
    <>
      <Field error={errors.itemName} errors={messages.errors} htmlFor="item-name" label={messages.add.item}>
        <input
          autoComplete="off"
          autoFocus={autoFocus}
          className={inputClass}
          enterKeyHint="next"
          id="item-name"
          list={listId}
          maxLength={60}
          name="itemName"
          onChange={(event) => setName(event.target.value)}
          placeholder={messages.add.itemPlaceholder}
          required
          value={name}
        />
        <datalist id={listId}>
          {items.map((item) => <option key={item.id} value={item.name} />)}
        </datalist>
        {matchCategory ? <p className="text-sm text-muted-foreground">{format(messages.add.itemCategory, { category: matchCategory.label })}</p> : null}
      </Field>

      {match ? null : (
        <Field error={errors.categoryId} errors={messages.errors} label={messages.add.newItemCategory}>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Chip defaultChecked={category.id === defaultCategoryId} key={category.id} label={category.label} name="categoryId" value={category.id} />
            ))}
          </div>
        </Field>
      )}
    </>
  );
}
