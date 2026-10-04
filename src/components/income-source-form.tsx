"use client";

import { useActionState } from "react";
import { createIncomeSource, updateIncomeSource } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Field, inputClass, SubmitButton } from "./form-controls";

/** Adds an income source, or edits one when `initial` is given. */
export function IncomeSourceForm({ locale, messages, initial }: {
  locale: string;
  messages: Messages;
  initial?: { id: string; name: string; isRideshare: boolean };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateIncomeSource : createIncomeSource, {});
  const errors = state.fieldErrors ?? {};
  const idPrefix = initial ? `source-${initial.id}` : "source-new";

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.settings.sourceName}>
        <input className={inputClass} defaultValue={initial?.name} id={`${idPrefix}-name`} maxLength={40} name="name" placeholder={messages.settings.sourceNamePlaceholder} required />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input className="size-5 accent-[var(--color-primary)]" defaultChecked={initial?.isRideshare} name="isRideshare" type="checkbox" />
        <span>{messages.settings.isRideshare}</span>
      </label>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.settings.addSource} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
