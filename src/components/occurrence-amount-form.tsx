"use client";

import { useActionState } from "react";
import { setOccurrenceAmount } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { inputClass } from "./form-controls";

/**
 * Sets one month's amount of a recurring payment. In `confirm` mode (a variable bill still estimated), a cash
 * bill also offers confirming and marking paid in one step.
 */
export function OccurrenceAmountForm({ locale, recurringPaymentId, month, amount, messages, mode = "change", isCash = false }: {
  locale: string;
  recurringPaymentId: string;
  month: string;
  amount: string;
  messages: Messages;
  mode?: "change" | "confirm";
  isCash?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setOccurrenceAmount, {});
  const error = state.fieldErrors?.amount;
  const inputId = `amount-${recurringPaymentId}-${month}`;
  const buttonClass = "min-h-10 rounded-xl px-3 text-sm font-semibold disabled:opacity-60";

  return (
    <form action={formAction} className="px-4 pb-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="recurringPaymentId" type="hidden" value={recurringPaymentId} />
      <input name="month" type="hidden" value={month} />
      <label className={mode === "confirm" ? "mb-1 block text-xs text-muted-foreground" : "sr-only"} htmlFor={inputId}>
        {mode === "confirm" ? messages.month.actualAmount : messages.recurring.amountThisMonth}
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input className={`${inputClass} min-h-10 w-32 flex-1 font-mono`} defaultValue={amount} id={inputId} inputMode="decimal" name="amount" required />
        {mode === "confirm" && isCash ? (
          <>
            <button className={`${buttonClass} border border-border text-foreground`} disabled={pending} name="markPaid" type="submit" value="false">
              {messages.month.confirm}
            </button>
            <button className={`${buttonClass} bg-primary text-primary-foreground`} disabled={pending} name="markPaid" type="submit" value="true">
              {messages.month.confirmAndPay}
            </button>
          </>
        ) : (
          <button className={`${buttonClass} bg-primary px-4 text-primary-foreground`} disabled={pending} type="submit">
            {pending ? messages.common.saving : mode === "confirm" ? messages.month.confirm : messages.common.save}
          </button>
        )}
      </div>
      {error ? <p className="mt-1 text-sm text-loss" role="alert">{messages.errors[error]}</p> : null}
    </form>
  );
}
