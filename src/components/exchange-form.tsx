"use client";

import { useActionState, useState } from "react";
import { createExchange } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { currencySymbol } from "@/lib/money";
import { MoneyInput } from "./amount-input";
import { useCurrency } from "./currency";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset, useClientId } from "./form-controls";

/**
 * Records money changed between currencies (`currencies`: the cash wallets', main first): what you gave and what
 * you got, at whatever rate the place offered. It starts from the other currency into the main one, the usual case.
 */
export function ExchangeForm({ locale, today, currencies, messages }: { locale: string; today: string; currencies: string[]; messages: Messages }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createExchange, {});
  const mainCurrency = useCurrency();
  const clientId = useClientId();
  const errors = state.fieldErrors ?? {};
  const [from, setFrom] = useState(currencies[1] ?? currencies[0]);
  const [to, setTo] = useState(currencies[0]);

  const side = (label: string, name: "from" | "to", value: string, onChange: (code: string) => void) => (
    <Field error={errors[`${name}Amount`]} errors={messages.errors} htmlFor={`exchange-${name}`} label={label}>
      <div className="flex flex-wrap gap-2">
        {currencies.map((code) => <Chip checked={code === value} key={code} label={code} name={`${name}Currency`} onChange={() => onChange(code)} value={code} />)}
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="font-mono text-xl text-muted-foreground">{currencySymbol(value, value !== mainCurrency)}</span>
        <MoneyInput className={`${inputClass} font-mono text-lg`} id={`exchange-${name}`} name={`${name}Amount`} />
      </div>
    </Field>
  );

  return (
    <form className="space-y-6" onSubmit={(event) => submitWithoutReset(event, formAction, clientId())}>
      <input name="locale" type="hidden" value={locale} />
      {side(messages.add.exchangeGave, "from", from, setFrom)}
      {side(messages.add.exchangeGot, "to", to, setTo)}
      {errors.toCurrency ? <p className="text-sm text-loss" role="alert">{messages.errors[errors.toCurrency]}</p> : null}
      <Field error={errors.date} errors={messages.errors} htmlFor="exchange-date" label={messages.add.date}>
        <input className={inputClass} defaultValue={today} id="exchange-date" name="date" required type="date" />
      </Field>
      <Field error={errors.note} errors={messages.errors} htmlFor="exchange-note" label={messages.add.note}>
        <input className={inputClass} id="exchange-note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>
      <p className="text-sm text-muted-foreground">{messages.add.exchangeHint}</p>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.add.saveExchange} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
