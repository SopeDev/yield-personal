"use client";

import { useActionState } from "react";
import { clearBalanceGoal, setBalanceGoal } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MoneyInput } from "./amount-input";
import { Field, inputClass } from "./form-controls";

/** Sets or removes the monthly balance goal. */
export function BalanceGoalForm({ locale, messages, goal }: { locale: string; messages: Messages; goal: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setBalanceGoal, {});
  const buttonClass = "min-h-12 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-60";

  return (
    <div className="space-y-3 p-4">
      <form action={formAction}>
        <input name="locale" type="hidden" value={locale} />
        <Field error={state.fieldErrors?.goal} errors={messages.errors} htmlFor="balance-goal" label={messages.settings.balanceGoal}>
          <div className="flex gap-2">
            <MoneyInput className={`${inputClass} font-mono`} defaultValue={goal ?? undefined} id="balance-goal" name="goal" />
            <button className={`${buttonClass} bg-primary text-primary-foreground`} disabled={pending} type="submit">
              {pending ? messages.common.saving : messages.common.save}
            </button>
          </div>
        </Field>
      </form>
      <p className="text-sm text-muted-foreground">{messages.settings.balanceGoalHint}</p>
      {goal ? (
        <form action={clearBalanceGoal}>
          <input name="locale" type="hidden" value={locale} />
          <button className="text-sm font-medium text-loss" type="submit">{messages.settings.balanceGoalRemove}</button>
        </form>
      ) : null}
    </div>
  );
}
