"use client";

import { useActionState } from "react";
import { setCashOnHand, type CashOnHandState } from "@/app/actions/settings";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { MoneyInput } from "./amount-input";
import { Field, inputClass } from "./form-controls";
import { useCurrency } from "./currency";
import { Money } from "./money";

/** Shows money on hand and sets it to what the user counts, noting how far the tracked amount was off. */
export function CashOnHandForm({ locale, messages, cents }: { locale: string; messages: Messages; cents: number | null }) {
  const [state, formAction, pending] = useActionState<CashOnHandState, FormData>(setCashOnHand, {});
  const currency = useCurrency();
  const offBy = state.offByCents ?? null;

  return (
    <div className="space-y-3 p-4">
      {cents !== null ? <Money cents={cents} className={cn("block text-3xl", cents < 0 && "text-loss")} /> : null}
      <form action={formAction}>
        <input name="locale" type="hidden" value={locale} />
        <Field error={state.fieldErrors?.amount} errors={messages.errors} htmlFor="cash-on-hand" label={messages.settings.cashOnHandAmount}>
          <div className="flex gap-2">
            <MoneyInput className={`${inputClass} font-mono`} id="cash-on-hand" name="amount" />
            <button className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
              {pending ? messages.common.saving : messages.common.save}
            </button>
          </div>
        </Field>
      </form>
      {offBy !== null ? (
        <p className={cn("text-sm", offBy < 0 ? "text-loss" : "text-gain")}>
          {offBy === 0 ? messages.settings.cashOnHandExact
            : format(offBy < 0 ? messages.settings.cashOnHandLess : messages.settings.cashOnHandMore, { amount: formatCents(Math.abs(offBy), currency) })}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{messages.settings.cashOnHandHint}</p>
    </div>
  );
}
