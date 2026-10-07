"use client";

import { useActionState } from "react";
import { createIncomeGroup, updateIncomeGroup } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { Field, inputClass, SubmitButton } from "./form-controls";

/** Adds an income group, or edits one when `initial` is given: its name and the categories its net is after. */
export function IncomeGroupForm({ locale, messages, categories, initial }: {
  locale: string;
  messages: Messages;
  categories: { id: string; label: string }[];
  initial?: { id: string; name: string; deductCategoryIds: string[] };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateIncomeGroup : createIncomeGroup, {});
  const idPrefix = initial ? `group-${initial.id}` : "group-new";

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={state.fieldErrors?.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.settings.groupName}>
        <input className={inputClass} defaultValue={initial?.name} id={`${idPrefix}-name`} maxLength={40} name="name" placeholder={messages.settings.groupNamePlaceholder} required />
      </Field>
      <Field errors={messages.errors} label={messages.settings.deducts}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label className="cursor-pointer" key={category.id}>
              <input className="peer sr-only" defaultChecked={initial?.deductCategoryIds.includes(category.id)} name="deductCategoryId" type="checkbox" value={category.id} />
              <span
                className={cn(
                  "flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium transition",
                  "peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-primary",
                )}
              >
                {category.label}
              </span>
            </label>
          ))}
        </div>
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.settings.addGroup} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
