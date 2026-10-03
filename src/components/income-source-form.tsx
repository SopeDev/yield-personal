"use client";

import { useActionState } from "react";
import { createIncomeSource } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Field, inputClass, SubmitButton } from "./form-controls";

export function IncomeSourceForm({ locale, messages }: { locale: string; messages: Messages }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createIncomeSource, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.name} errors={messages.errors} htmlFor="source-name" label={messages.settings.sourceName}>
        <input className={inputClass} id="source-name" maxLength={40} name="name" placeholder={messages.settings.sourceNamePlaceholder} required />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input className="size-5 accent-[var(--color-primary)]" name="isRideshare" type="checkbox" />
        <span>{messages.settings.isRideshare}</span>
      </label>
      <SubmitButton label={messages.settings.addSource} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
