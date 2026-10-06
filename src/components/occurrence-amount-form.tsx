"use client";

import { useActionState, useState } from "react";
import { setOccurrenceAmount } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MoneyInput } from "./amount-input";
import { Chip, inputClass } from "./form-controls";

export type OccurrenceMethodOption = { id: string; label: string; color: string; isCard: boolean };

/**
 * Sets one month's amount and payment method of a recurring payment. A different method also becomes the usual
 * one for later months. In `confirm` mode (a variable bill still estimated), confirming also marks a cash bill
 * paid; a card bill is paid with its statement.
 */
export function OccurrenceAmountForm({ locale, recurringPaymentId, month, amount, paymentMethodId, methods, messages, mode = "change" }: {
  locale: string;
  recurringPaymentId: string;
  month: string;
  amount: string;
  paymentMethodId: string;
  methods: OccurrenceMethodOption[];
  messages: Messages;
  mode?: "change" | "confirm";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setOccurrenceAmount, {});
  const [methodId, setMethodId] = useState(paymentMethodId);
  const isCash = !(methods.find((method) => method.id === methodId)?.isCard ?? false);
  const error = state.fieldErrors?.amount ?? state.fieldErrors?.paymentMethodId;
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
        <MoneyInput className={`${inputClass} min-h-10 w-32 flex-1 font-mono`} defaultValue={amount} id={inputId} name="amount" />
        {/* Confirming a variable bill also pays it: a cash bill is marked paid; a card bill follows its statement. */}
        {mode === "confirm" ? <input name="markPaid" type="hidden" value="true" /> : null}
        <button className={`${buttonClass} bg-primary px-4 text-primary-foreground`} disabled={pending} type="submit">
          {pending ? messages.common.saving : mode === "change" ? messages.common.save : isCash ? messages.month.confirmAndPay : messages.month.confirm}
        </button>
      </div>
      {methods.length > 1 ? (
        <fieldset className="mt-3">
          <legend className="mb-1 text-xs text-muted-foreground">{messages.add.paidWith}</legend>
          <div className="flex flex-wrap gap-2">
            {methods.map((method) => (
              <Chip checked={method.id === methodId} color={method.color} key={method.id} label={method.label} name="paymentMethodId" onChange={() => setMethodId(method.id)} value={method.id} />
            ))}
          </div>
          {methodId !== paymentMethodId ? <p className="mt-1 text-xs text-muted-foreground">{messages.month.methodFromHere}</p> : null}
        </fieldset>
      ) : null}
      {error ? <p className="mt-1 text-sm text-loss" role="alert">{messages.errors[error]}</p> : null}
    </form>
  );
}
