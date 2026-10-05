"use client";

import { useActionState, useState } from "react";
import { createRecurringPayment, updateRecurringPayment } from "@/app/actions/recurring";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { MoneyInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";
import { ItemField, type CategoryOption, type ItemOption } from "./item-field";

type Option = { id: string; label: string; color?: string };

/** Values of an existing recurring payment being edited. */
export type RecurringInitial = {
  id: string;
  itemName: string;
  amount: string;
  dayOfMonth: number;
  paymentMethodId: string;
  isVariable: boolean;
  intervalMonths: number;
};

const DEFAULT_CATEGORY_KEY = "fixed";
const INTERVAL_OPTIONS = [1, 2, 3, 6, 12] as const;

/** Creates a recurring payment, or edits one when `initial` is given. */
export function RecurringForm({ locale, currentMonth, items, categories, methods, messages, initial }: {
  locale: string;
  currentMonth: string;
  items: ItemOption[];
  categories: CategoryOption[];
  methods: Option[];
  messages: Messages;
  initial?: RecurringInitial;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateRecurringPayment : createRecurringPayment, {});
  const [isVariable, setIsVariable] = useState(initial?.isVariable ?? false);
  const [intervalMonths, setIntervalMonths] = useState(initial?.intervalMonths ?? 1);
  const errors = state.fieldErrors ?? {};
  const idPrefix = initial ? `recurring-${initial.id}` : "recurring-new";
  const selectedMethodId = initial?.paymentMethodId ?? methods[0]?.id;

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <ItemField
        categories={categories}
        defaultCategoryKey={DEFAULT_CATEGORY_KEY}
        defaultName={initial?.itemName}
        errors={errors}
        items={items}
        messages={messages}
      />

      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input checked={isVariable} className="mt-1 size-5 accent-[var(--color-primary)]" name="isVariable" onChange={(event) => setIsVariable(event.target.checked)} type="checkbox" />
        <span>
          <span className="block font-medium">{messages.recurring.variable}</span>
          <span className="block text-sm text-muted-foreground">{messages.recurring.variableHint}</span>
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.amount} errors={messages.errors} htmlFor={`${idPrefix}-amount`} label={isVariable ? messages.recurring.estimateFallback : messages.recurring.usualAmount}>
          <MoneyInput className={`${inputClass} font-mono`} defaultValue={initial?.amount} id={`${idPrefix}-amount`} name="amount" />
        </Field>
        <Field error={errors.dayOfMonth} errors={messages.errors} htmlFor={`${idPrefix}-day`} label={messages.recurring.dayOfMonth}>
          <input className={`${inputClass} font-mono`} defaultValue={initial?.dayOfMonth} id={`${idPrefix}-day`} inputMode="numeric" max={MAX_STATEMENT_DAY} min={1} name="dayOfMonth" required type="number" />
        </Field>
      </div>

      <Field error={errors.intervalMonths} errors={messages.errors} label={messages.recurring.repeats}>
        <div className="flex flex-wrap gap-2">
          {INTERVAL_OPTIONS.map((months) => (
            <Chip
              checked={intervalMonths === months}
              key={months}
              label={months === 1 ? messages.recurring.everyMonth : format(messages.recurring.everyMonths, { months })}
              name="intervalMonths"
              onChange={() => setIntervalMonths(months)}
              value={String(months)}
            />
          ))}
        </div>
        {intervalMonths > 1 && !initial ? <p className="text-sm text-muted-foreground">{messages.recurring.intervalHint}</p> : null}
      </Field>

      <Field error={errors.paymentMethodId} errors={messages.errors} label={messages.add.paidWith}>
        <div className="flex flex-wrap gap-2">
          {methods.map((method) => (
            <Chip color={method.color} defaultChecked={method.id === selectedMethodId} key={method.id} label={method.label} name="paymentMethodId" value={method.id} />
          ))}
        </div>
      </Field>

      {initial ? (
        <p className="text-sm text-muted-foreground">{messages.recurring.editHint}</p>
      ) : (
        <Field error={errors.startMonth} errors={messages.errors} htmlFor={`${idPrefix}-start`} label={messages.recurring.startMonth}>
          <input className={inputClass} defaultValue={currentMonth} id={`${idPrefix}-start`} name="startMonth" required type="month" />
        </Field>
      )}

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.recurring.saveChanges : messages.recurring.add} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
