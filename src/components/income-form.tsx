"use client";

import { useActionState } from "react";
import { createIncome } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { AmountInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset } from "./form-controls";

export function IncomeForm({ locale, today, sources, messages }: {
  locale: string;
  today: string;
  sources: { id: string; name: string }[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createIncome, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form className="space-y-6" onSubmit={(event) => submitWithoutReset(event, formAction)}>
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.amount} errors={messages.errors} htmlFor="amount" label={messages.add.amount}>
        <AmountInput autoFocus />
      </Field>

      <Field error={errors.sourceId} errors={messages.errors} label={messages.add.source}>
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <Chip defaultChecked={index === 0} key={source.id} label={source.name} name="sourceId" value={source.id} />
          ))}
        </div>
      </Field>

      <Field error={errors.date} errors={messages.errors} htmlFor="date" label={messages.add.date}>
        <input className={inputClass} defaultValue={today} id="date" name="date" required type="date" />
      </Field>

      <Field error={errors.note} errors={messages.errors} htmlFor="note" label={messages.add.note}>
        <input className={inputClass} id="note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.add.saveIncome} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
