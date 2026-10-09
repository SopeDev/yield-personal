"use client";

import { useActionState } from "react";
import { createCashWallet } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

/** Adds a cash wallet in a currency that doesn't have one yet (`currencies`, each with its name). */
export function CashWalletForm({ locale, messages, currencies }: { locale: string; messages: Messages; currencies: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCashWallet, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.currency} errors={messages.errors} label={messages.settings.walletCurrency}>
        <div className="flex flex-wrap gap-2">
          {currencies.map((currency, index) => (
            <Chip defaultChecked={index === 0} key={currency.code} label={`${currency.code} · ${currency.name}`} name="currency" value={currency.code} />
          ))}
        </div>
      </Field>
      <Field error={errors.name} errors={messages.errors} htmlFor="wallet-name" label={messages.settings.walletName}>
        <input className={inputClass} id="wallet-name" maxLength={40} name="name" placeholder={messages.settings.walletNamePlaceholder} />
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.settings.addWallet} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
