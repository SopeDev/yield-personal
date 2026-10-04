"use client";

import { useActionState } from "react";
import { createRecurringPayment } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";
import { ItemField, type CategoryOption, type ItemOption } from "./item-field";

type Option = { id: string; label: string; color?: string };

const DEFAULT_CATEGORY_KEY = "fixed";

export function RecurringForm({ locale, currentMonth, items, categories, methods, messages }: {
  locale: string;
  currentMonth: string;
  items: ItemOption[];
  categories: CategoryOption[];
  methods: Option[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRecurringPayment, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <ItemField categories={categories} defaultCategoryKey={DEFAULT_CATEGORY_KEY} errors={errors} items={items} messages={messages} />

      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.amount} errors={messages.errors} htmlFor="recurring-amount" label={messages.recurring.defaultAmount}>
          <input className={`${inputClass} font-mono`} id="recurring-amount" inputMode="decimal" name="amount" placeholder="0.00" required />
        </Field>
        <Field error={errors.dayOfMonth} errors={messages.errors} htmlFor="recurring-day" label={messages.recurring.dayOfMonth}>
          <input className={`${inputClass} font-mono`} id="recurring-day" inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="dayOfMonth" required type="number" />
        </Field>
      </div>

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
