"use client";

import { useActionState } from "react";
import { createCard } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { Field, inputClass, SubmitButton } from "./form-controls";

export function CardForm({ locale, messages, usedColors }: { locale: string; messages: Messages; usedColors: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createCard, {});
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

      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.closingDay} errors={messages.errors} htmlFor="closing-day" label={messages.settings.closingDay}>
          <input className={`${inputClass} font-mono`} id="closing-day" inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="closingDay" required type="number" />
        </Field>
        <Field error={errors.dueDay} errors={messages.errors} htmlFor="due-day" label={messages.settings.dueDay}>
          <input className={`${inputClass} font-mono`} id="due-day" inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="dueDay" required type="number" />
        </Field>
      </div>

      <SubmitButton label={messages.settings.addCard} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
