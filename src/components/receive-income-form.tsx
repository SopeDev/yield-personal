"use client";

import { useActionState } from "react";
import { receiveRecurringIncome } from "@/app/actions/recurring-income";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MoneyInput } from "./amount-input";
import { inputClass } from "./form-controls";

/** Records the income received for a recurring income's payday, with the amount that actually arrived. */
export function ReceiveIncomeForm({ locale, recurringIncomeId, payday, amount, messages }: {
  locale: string;
  recurringIncomeId: string;
  /** The payday, "YYYY-MM-DD". */
  payday: string;
  amount: string;
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(receiveRecurringIncome, {});
  const error = state.fieldErrors?.amount ?? state.error;
  const inputId = `received-${recurringIncomeId}-${payday}`;

  return (
    <form action={formAction} className="px-4 pb-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="recurringIncomeId" type="hidden" value={recurringIncomeId} />
      <input name="payday" type="hidden" value={payday} />
      <label className="mb-1 block text-xs text-muted-foreground" htmlFor={inputId}>{messages.month.receivedAmount}</label>
      <div className="flex flex-wrap items-start gap-2">
        <MoneyInput className={`${inputClass} min-h-10 w-32 flex-1 font-mono`} defaultValue={amount} id={inputId} name="amount" />
        <button className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
          {pending ? messages.common.saving : messages.month.markReceived}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-loss" role="alert">{messages.errors[error]}</p> : null}
    </form>
  );
}
