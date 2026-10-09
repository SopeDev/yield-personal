"use client";

import { useActionState, useState } from "react";
import { createIncome, updateIncome } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { AmountInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset, useClientId } from "./form-controls";

/** Values of an existing income entry being edited. */
export type IncomeInitial = { id: string; amount: string; sourceId: string; date: string; note: string; currency: string };

/**
 * Records new income, or edits an entry when `initial` is given. With cash wallets in several currencies
 * (`currencies`, the main one first), it asks which one the income came in; it lands in that wallet.
 */
export function IncomeForm({ locale, today, sources, currencies, messages, initial, amount, onAmountChange }: {
  locale: string;
  today: string;
  sources: { id: string; name: string }[];
  currencies: string[];
  messages: Messages;
  initial?: IncomeInitial;
  /** An amount kept by the parent, such as quick add sharing it between the expense and income tabs. */
  amount?: string;
  onAmountChange?: (amount: string) => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateIncome : createIncome, {});
  const clientId = useClientId();
  const errors = state.fieldErrors ?? {};
  const [currency, setCurrency] = useState(initial?.currency ?? currencies[0]);

  return (
    <form className="space-y-6" onSubmit={(event) => submitWithoutReset(event, formAction, initial ? undefined : clientId())}>
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.amount} errors={messages.errors} htmlFor="amount" label={messages.add.amount}>
        <AmountInput autoFocus={!initial} currency={currency} defaultValue={initial?.amount} onChange={onAmountChange} value={amount} />
      </Field>

      {currencies.length > 1 ? (
        <Field error={errors.currency} errors={messages.errors} label={messages.add.currency}>
          <div className="flex flex-wrap gap-2">
            {currencies.map((code) => <Chip checked={code === currency} key={code} label={code} name="currency" onChange={() => setCurrency(code)} value={code} />)}
          </div>
        </Field>
      ) : <input name="currency" type="hidden" value={currency} />}

      <Field error={errors.sourceId} errors={messages.errors} label={messages.add.source}>
        <div className="flex flex-wrap gap-2">
          {sources.map((source, index) => (
            <Chip defaultChecked={initial ? source.id === initial.sourceId : index === 0} key={source.id} label={source.name} name="sourceId" value={source.id} />
          ))}
        </div>
      </Field>

      <Field error={errors.date} errors={messages.errors} htmlFor="date" label={messages.add.date}>
        <input className={inputClass} defaultValue={initial?.date ?? today} id="date" name="date" required type="date" />
      </Field>

      <Field error={errors.note} errors={messages.errors} htmlFor="note" label={messages.add.note}>
        <input className={inputClass} defaultValue={initial?.note} id="note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.add.saveIncome} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
