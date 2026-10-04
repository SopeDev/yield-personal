"use client";

import { useActionState, useState } from "react";
import { createCard } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { DEFAULT_PAYMENT_DAYS, MAX_PAYMENT_DAYS } from "@/lib/statements";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { Field, inputClass, SubmitButton } from "./form-controls";

const PAYMENT_DAY_PRESETS = [15, 20, 30] as const;

export function CardForm({ locale, messages, usedColors }: { locale: string; messages: Messages; usedColors: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCard, {});
  const [paymentDays, setPaymentDays] = useState(String(DEFAULT_PAYMENT_DAYS));
  const errors = state.fieldErrors ?? {};
  const firstFreeColor = CARD_COLORS.find((color) => !usedColors.includes(color)) ?? CARD_COLORS[0];

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.name} errors={messages.errors} htmlFor="card-name" label={messages.settings.cardName}>
        <input className={inputClass} id="card-name" maxLength={40} name="name" placeholder={messages.settings.cardNamePlaceholder} required />
      </Field>

      <Field error={errors.color} errors={messages.errors} label={messages.settings.color}>
        <div className="flex flex-wrap gap-3">
          {CARD_COLORS.map((color) => (
            <label className="cursor-pointer" key={color}>
              <input className="peer sr-only" defaultChecked={color === firstFreeColor} name="color" type="radio" value={color} />
              <span
                aria-label={color}
                className="block size-9 rounded-full ring-offset-2 ring-offset-surface transition peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </Field>

      <Field error={errors.closingDay} errors={messages.errors} htmlFor="closing-day" label={messages.settings.closingDay}>
        <input className={`${inputClass} w-28 font-mono`} id="closing-day" inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="closingDay" required type="number" />
      </Field>

      <Field error={errors.paymentDays} errors={messages.errors} htmlFor="payment-days" label={messages.settings.paymentDays}>
        <div className="flex flex-wrap items-center gap-2">
          {PAYMENT_DAY_PRESETS.map((days) => (
            <button
              aria-pressed={paymentDays === String(days)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition",
                paymentDays === String(days) ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface",
              )}
              key={days}
              onClick={() => setPaymentDays(String(days))}
              type="button"
            >
              {format(messages.settings.daysOption, { days })}
            </button>
          ))}
          <input
            aria-label={messages.settings.paymentDays}
            className={`${inputClass} w-24 text-center font-mono`}
            id="payment-days"
            inputMode="numeric"
            max={MAX_PAYMENT_DAYS}
            min={1}
            name="paymentDays"
            onChange={(event) => setPaymentDays(event.target.value)}
            required
            type="number"
            value={paymentDays}
          />
        </div>
        <p className="text-sm text-muted-foreground">{messages.settings.paymentDaysHint}</p>
      </Field>

      <SubmitButton label={messages.settings.addCard} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
