"use client";

import { useActionState } from "react";
import { createCategory, updateCategory } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Field, inputClass, SubmitButton } from "./form-controls";

/**
 * Adds a category, or edits one when `initial` is given. A built-in category can be left without a custom name,
 * in which case it keeps its translated label (`defaultLabel`).
 */
export function CategoryForm({ locale, messages, initial }: {
  locale: string;
  messages: Messages;
  initial?: { id: string; name: string; defaultLabel: string | null; includeInAverage: boolean };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateCategory : createCategory, {});
  const idPrefix = initial ? `category-${initial.id}` : "category-new";
  const isBuiltIn = Boolean(initial?.defaultLabel);

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={state.fieldErrors?.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.manage.categoryName}>
        <input
          className={inputClass}
          defaultValue={initial?.name}
          id={`${idPrefix}-name`}
          maxLength={40}
          name="name"
          placeholder={initial?.defaultLabel ?? messages.manage.categoryNamePlaceholder}
          required={!isBuiltIn}
        />
        {isBuiltIn ? <p className="text-sm text-muted-foreground">{messages.manage.builtInNameHint}</p> : null}
      </Field>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input className="mt-1 size-5 accent-[var(--color-primary)]" defaultChecked={initial?.includeInAverage ?? true} name="includeInAverage" type="checkbox" />
        <span>
          <span className="block font-medium">{messages.manage.includeInAverage}</span>
          <span className="block text-sm text-muted-foreground">{messages.manage.includeInAverageHint}</span>
        </span>
      </label>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.manage.addCategory} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
