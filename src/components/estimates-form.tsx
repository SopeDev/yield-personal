"use client";

import { useActionState } from "react";
import { setEstimates } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MoneyInput } from "./amount-input";
import { Field, inputClass } from "./form-controls";

/** The setup wizard's starting estimates, to correct: monthly spending per everyday category, and varying income. */
export function EstimatesForm({ locale, messages, categories, incomeEstimate }: {
  locale: string;
  messages: Messages;
  categories: { id: string; label: string; estimate: string | null }[];
  incomeEstimate: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setEstimates, {});
  const m = messages.settings;

  return (
    <form action={formAction} className="space-y-4 p-4">
      <input name="locale" type="hidden" value={locale} />
      <Field error={state.fieldErrors?.estimates} errors={messages.errors} label={m.spendingEstimates}>
        <div className="divide-y divide-border rounded-xl border border-border">
          {categories.map((category) => (
            <label className="flex items-center gap-3 px-4 py-2" key={category.id}>
              <span className="flex-1 font-medium">{category.label}</span>
              <MoneyInput className={`${inputClass} w-36 text-right font-mono`} defaultValue={category.estimate ?? undefined} id={`estimate-${category.id}`} name={`estimate:${category.id}`} />
            </label>
          ))}
        </div>
      </Field>
      <Field error={state.fieldErrors?.incomeEstimate} errors={messages.errors} htmlFor="income-estimate" label={m.incomeEstimate}>
        <MoneyInput className={`${inputClass} font-mono`} defaultValue={incomeEstimate ?? undefined} id="income-estimate" name="incomeEstimate" />
      </Field>
      <p className="text-sm text-muted-foreground">{m.estimatesHint}</p>
      <button className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? messages.common.saving : messages.common.save}
      </button>
    </form>
  );
}
