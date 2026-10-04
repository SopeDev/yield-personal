"use client";

import { useActionState } from "react";
import { createCard, updateCard } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { DEFAULT_PAYMENT_DAYS, MAX_PAYMENT_DAYS } from "@/lib/statements";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { Field, inputClass, SubmitButton } from "./form-controls";

/** Values of an existing card being edited. */
export type CardInitial = { id: string; name: string; color: string; closingDay: number; paymentDays: number };

/** Adds a card, or edits one when `initial` is given. */
export function CardForm({ locale, messages, usedColors, initial }: { locale: string; messages: Messages; usedColors: string[]; initial?: CardInitial }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateCard : createCard, {});
  const errors = state.fieldErrors ?? {};
  const selectedColor = initial?.color ?? CARD_COLORS.find((color) => !usedColors.includes(color)) ?? CARD_COLORS[0];
  const idPrefix = initial ? `card-${initial.id}` : "card-new";

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.settings.cardName}>
        <input className={inputClass} defaultValue={initial?.name} id={`${idPrefix}-name`} maxLength={40} name="name" placeholder={messages.settings.cardNamePlaceholder} required />
      </Field>

      <Field error={errors.color} errors={messages.errors} label={messages.settings.color}>
        <div className="flex flex-wrap gap-3">
          {CARD_COLORS.map((color) => (
            <label className="cursor-pointer" key={color}>
              <input className="peer sr-only" defaultChecked={color === selectedColor} name="color" type="radio" value={color} />
              <span
                aria-label={color}
                className="block size-9 rounded-full ring-offset-2 ring-offset-surface transition peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </Field>

      <Field error={errors.closingDay} errors={messages.errors} htmlFor={`${idPrefix}-closing`} label={messages.settings.closingDay}>
        <input className={`${inputClass} w-28 font-mono`} defaultValue={initial?.closingDay} id={`${idPrefix}-closing`} inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="closingDay" required type="number" />
      </Field>

      <Field error={errors.paymentDays} errors={messages.errors} htmlFor={`${idPrefix}-days`} label={messages.settings.paymentDays}>
        <input
          className={`${inputClass} w-28 font-mono`}
          defaultValue={initial?.paymentDays}
          id={`${idPrefix}-days`}
          inputMode="numeric"
          max={MAX_PAYMENT_DAYS}
          min={1}
          name="paymentDays"
          placeholder={String(DEFAULT_PAYMENT_DAYS)}
          required
          type="number"
        />
        <p className="text-sm text-muted-foreground">{messages.settings.paymentDaysHint}</p>
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.settings.addCard} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
