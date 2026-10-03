"use client";

import { useActionState, useState } from "react";
import { createPurchase } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { splitInstallments, MAX_INSTALLMENTS } from "@/lib/installments";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { AmountInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset } from "./form-controls";

type Option = { id: string; label: string; color?: string };
type MethodOption = Option & { isCard: boolean };

const DEFAULT_CATEGORY_KEY = "food";

export function ExpenseForm({ locale, today, categories, methods, messages }: {
  locale: string;
  today: string;
  categories: (Option & { key: string | null })[];
  methods: MethodOption[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPurchase, {});
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const errors = state.fieldErrors ?? {};
  const isCard = methods.find((method) => method.id === methodId)?.isCard ?? false;
  const defaultCategoryId = (categories.find((category) => category.key === DEFAULT_CATEGORY_KEY) ?? categories[0])?.id;

  const amountCents = parseAmountToCents(amount);
  const installmentCount = Number(installments);
  const installmentPreview = isCard && amountCents && Number.isInteger(installmentCount) && installmentCount > 1 && installmentCount <= MAX_INSTALLMENTS
    ? format(messages.add.monthlyInstallment, { count: installmentCount, amount: formatCents(splitInstallments(amountCents, installmentCount)[0]) })
    : messages.add.singlePayment;

  return (
    <form className="space-y-6" onSubmit={(event) => submitWithoutReset(event, formAction)}>
      <input name="locale" type="hidden" value={locale} />
      <Field error={errors.amount} errors={messages.errors} htmlFor="amount" label={messages.add.amount}>
        <AmountInput autoFocus onChange={setAmount} />
      </Field>

      <Field error={errors.description} errors={messages.errors} htmlFor="description" label={messages.add.description}>
        <input className={inputClass} enterKeyHint="done" id="description" maxLength={120} name="description" placeholder={messages.add.descriptionPlaceholder} required />
      </Field>

      <Field error={errors.categoryId} errors={messages.errors} label={messages.add.category}>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Chip defaultChecked={category.id === defaultCategoryId} key={category.id} label={category.label} name="categoryId" value={category.id} />
          ))}
        </div>
      </Field>

      <Field error={errors.paymentMethodId} errors={messages.errors} label={messages.add.paidWith}>
        <div className="flex flex-wrap gap-2">
          {methods.map((method) => (
            <Chip checked={method.id === methodId} color={method.color} key={method.id} label={method.label} name="paymentMethodId" onChange={() => setMethodId(method.id)} value={method.id} />
          ))}
        </div>
      </Field>

      {isCard ? (
        <Field error={errors.installments} errors={messages.errors} htmlFor="installments" label={messages.add.installments}>
          <div className="flex items-center gap-3">
            <input
              className={`${inputClass} w-24 text-center font-mono`}
              id="installments"
              inputMode="numeric"
              max={MAX_INSTALLMENTS}
              min={1}
              name="installments"
              onChange={(event) => setInstallments(event.target.value)}
              type="number"
              value={installments}
            />
            <p className="text-sm text-muted-foreground">{installmentPreview}</p>
          </div>
        </Field>
      ) : null}

      <Field error={errors.date} errors={messages.errors} htmlFor="date" label={messages.add.date}>
        <input className={inputClass} defaultValue={today} id="date" name="date" required type="date" />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.add.saveExpense} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
