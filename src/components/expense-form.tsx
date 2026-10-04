"use client";

import { useActionState, useState } from "react";
import { createPurchase } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { splitInstallments, MAX_INSTALLMENTS } from "@/lib/installments";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { AmountInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset } from "./form-controls";
import { ItemField, type CategoryOption, type ItemOption } from "./item-field";

type MethodOption = { id: string; label: string; color?: string; isCard: boolean };

const DEFAULT_CATEGORY_KEY = "food";

export function ExpenseForm({ locale, today, items, categories, methods, messages }: {
  locale: string;
  today: string;
  items: ItemOption[];
  categories: CategoryOption[];
  methods: MethodOption[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPurchase, {});
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const errors = state.fieldErrors ?? {};
  const isCard = methods.find((method) => method.id === methodId)?.isCard ?? false;

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

      <ItemField categories={categories} defaultCategoryKey={DEFAULT_CATEGORY_KEY} errors={errors} items={items} messages={messages} />

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

      <Field error={errors.note} errors={messages.errors} htmlFor="note" label={messages.add.note}>
        <input className={inputClass} id="note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={messages.add.saveExpense} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
