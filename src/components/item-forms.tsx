"use client";

import { useActionState, useState } from "react";
import { mergeItems, updateItem } from "@/app/actions/items";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

type CategoryOption = { id: string; label: string };

/** Renames an item or moves it, with all its history, to another category. */
export function ItemEditForm({ locale, messages, item, categories }: {
  locale: string;
  messages: Messages;
  item: { id: string; name: string; categoryId: string };
  categories: CategoryOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateItem, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="id" type="hidden" value={item.id} />
      <Field error={errors.name} errors={messages.errors} htmlFor={`item-${item.id}-name`} label={messages.add.item}>
        <input className={inputClass} defaultValue={item.name} id={`item-${item.id}-name`} maxLength={60} name="name" required />
      </Field>
      <Field error={errors.categoryId} errors={messages.errors} label={messages.add.category}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Chip defaultChecked={category.id === item.categoryId} key={category.id} label={category.label} name="categoryId" value={category.id} />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{messages.manage.moveHint}</p>
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.common.saveChanges} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}

/** Combines this item into another: every purchase and recurring payment moves to the target, then this item is removed. */
export function ItemMergeForm({ locale, messages, item, targets }: {
  locale: string;
  messages: Messages;
  item: { id: string; name: string };
  targets: { id: string; name: string }[];
}) {
  const [targetId, setTargetId] = useState("");
  const target = targets.find((option) => option.id === targetId);
  if (targets.length === 0) return null;

  return (
    <form
      action={mergeItems}
      className="flex flex-wrap items-end gap-2 border-t border-border p-4"
      onSubmit={(event) => {
        if (!target || !window.confirm(format(messages.manage.confirmMerge, { source: item.name, target: target.name }))) event.preventDefault();
      }}
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="sourceId" type="hidden" value={item.id} />
      <div className="min-w-40 flex-1">
        <label className="mb-2 block text-sm font-medium text-muted-foreground" htmlFor={`merge-${item.id}`}>{messages.manage.mergeInto}</label>
        <select className={inputClass} id={`merge-${item.id}`} name="targetId" onChange={(event) => setTargetId(event.target.value)} required value={targetId}>
          <option value="">{messages.manage.chooseItem}</option>
          {targets.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </div>
      <button className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50" disabled={!target} type="submit">
        {messages.manage.merge}
      </button>
    </form>
  );
}
