"use client";

import { useActionState } from "react";
import { setOccurrenceAmount } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { inputClass } from "./form-controls";

/** Changes one month's amount of a recurring payment. */
export function OccurrenceAmountForm({ locale, recurringPaymentId, month, amount, messages }: {
  locale: string;
  recurringPaymentId: string;
  month: string;
  amount: string;
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setOccurrenceAmount, {});
  const error = state.fieldErrors?.amount;

  return (
    <form action={formAction} className="flex items-start gap-2 px-4 pb-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="recurringPaymentId" type="hidden" value={recurringPaymentId} />
      <input name="month" type="hidden" value={month} />
      <div className="flex-1">
        <label className="sr-only" htmlFor={`amount-${recurringPaymentId}`}>{messages.recurring.amountThisMonth}</label>
        <input
          className={`${inputClass} min-h-10 font-mono`}
          defaultValue={amount}
          id={`amount-${recurringPaymentId}`}
          inputMode="decimal"
          name="amount"
          required
        />
        {error ? <p className="mt-1 text-sm text-loss" role="alert">{messages.errors[error]}</p> : null}
      </div>
      <button className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? messages.common.saving : messages.common.save}
      </button>
    </form>
  );
}
