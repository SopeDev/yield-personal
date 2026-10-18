"use client";

import { useActionState, useState } from "react";
import { sendFeedback } from "@/app/actions/feedback";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { Field, inputClass, SubmitButton } from "./form-controls";

/** A message for the app's owner; once sent, a thank-you with the option to write another. */
export function FeedbackForm({ locale, messages }: { locale: string; messages: Messages }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(sendFeedback, {});
  const [another, setAnother] = useState<number | undefined>(undefined);
  const m = messages.feedback;
  const sent = state.savedAt !== undefined && state.savedAt !== another;

  if (sent) {
    return (
      <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
        <p className="font-medium text-primary">{m.thanks}</p>
        <p className="text-sm text-muted-foreground">{m.thanksBody}</p>
        <button className="text-sm font-medium text-primary" onClick={() => setAnother(state.savedAt)} type="button">{m.another}</button>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={state.fieldErrors?.message} errors={messages.errors} htmlFor="feedback-message" label={m.messageLabel}>
        <textarea className={`${inputClass} min-h-40 py-3`} id="feedback-message" maxLength={MAX_FEEDBACK_LENGTH} name="message" placeholder={m.placeholder} required />
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{m.tooMany}</p> : null}
      <SubmitButton label={m.send} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
