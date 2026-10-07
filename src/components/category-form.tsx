"use client";

import { useActionState, useState } from "react";
import { createCategory, updateCategory } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { CATEGORY_KINDS, type CategoryKind } from "@/lib/categories";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

/**
 * Adds a category, or edits one when `initial` is given. A built-in category can be left without a custom name,
 * in which case it keeps its translated label (`defaultLabel`).
 */
export function CategoryForm({ locale, messages, initial }: {
  locale: string;
  messages: Messages;
  initial?: { id: string; name: string; defaultLabel: string | null; kind: CategoryKind };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateCategory : createCategory, {});
  const idPrefix = initial ? `category-${initial.id}` : "category-new";
  const isBuiltIn = Boolean(initial?.defaultLabel);
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "EVERYDAY");

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
      <Field errors={messages.errors} label={messages.manage.categoryKind}>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KINDS.map((option) => (
            <Chip checked={option === kind} key={option} label={messages.manage[`kind${option}`]} name="kind" onChange={() => setKind(option)} value={option} />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{messages.manage[`kindHint${kind}`]}</p>
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.manage.addCategory} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
