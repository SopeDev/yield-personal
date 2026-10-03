"use client";

import { useActionState } from "react";
import { createRecurringPayment } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

type Option = { id: string; label: string; color?: string };

const DEFAULT_CATEGORY_KEY = "fixed";

export function RecurringForm({ locale, currentMonth, categories, methods, messages }: {
  locale: string;
  currentMonth: string;
  categories: (Option & { key: string | null })[];
  methods: Option[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRecurringPayment, {});
  const errors = state.fieldErrors ?? {};
  const defaultCategoryId = (categories.find((category) => category.key === DEFAULT_CATEGORY_KEY) ?? categories[0])?.id;

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.name} errors={messages.errors} htmlFor="recurring-name" label={messages.recurring.name}>
        <input className={inputClass} id="recurring-name" maxLength={60} name="name" placeholder={messages.recurring.namePlaceholder} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.amount} errors={messages.errors} htmlFor="recurring-amount" label={messages.recurring.defaultAmount}>
          <input className={`${inputClass} font-mono`} id="recurring-amount" inputMode="decimal" name="amount" placeholder="0.00" required />
        </Field>
        <Field error={errors.dayOfMonth} errors={messages.errors} htmlFor="recurring-day" label={messages.recurring.dayOfMonth}>
          <input className={`${inputClass} font-mono`} id="recurring-day" inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="dayOfMonth" required type="number" />
        </Field>
      </div>

      <Field error={errors.categoryId} errors={messages.errors} label={messages.add.category}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Chip defaultChecked={category.id === defaultCategoryId} key={category.id} label={category.label} name="categoryId" value={category.id} />
          ))}
        </div>
      </Field>

      <Field error={errors.paymentMethodId} errors={messages.errors} label={messages.add.paidWith}>
        <div className="flex flex-wrap gap-2">
          {methods.map((method, index) => (
            <Chip color={method.color} defaultChecked={index === 0} key={method.id} label={method.label} name="paymentMethodId" value={method.id} />
          ))}
        </div>
      </Field>

      <Field error={errors.startMonth} errors={messages.errors} htmlFor="recurring-start" label={messages.recurring.startMonth}>
        <input className={inputClass} defaultValue={currentMonth} id="recurring-start" name="startMonth" required type="month" />
      </Field>

      <SubmitButton label={messages.recurring.add} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
