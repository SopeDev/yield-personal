"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createGoalFund, createSavingsMovement, updateSavingsFund } from "@/app/actions/savings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { MoneyInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset, useClientId } from "./form-controls";

/** Records money moved into or out of a savings fund. Stays on the page and clears after each save. */
export function SavingsMovementForm({ locale, today, funds, messages }: {
  locale: string;
  today: string;
  funds: { id: string; label: string }[];
  messages: Messages;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSavingsMovement, {});
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const formRef = useRef<HTMLFormElement>(null);
  const clientId = useClientId(state.savedAt);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  return (
    <form className="space-y-5 p-4" onSubmit={(event) => submitWithoutReset(event, formAction, clientId())} ref={formRef}>
      <input name="locale" type="hidden" value={locale} />
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
        {(["deposit", "withdraw"] as const).map((option) => (
          <label className="cursor-pointer" key={option}>
            <input checked={direction === option} className="peer sr-only" name="direction" onChange={() => setDirection(option)} type="radio" value={option} />
            <span className="flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold text-muted-foreground transition peer-checked:bg-surface peer-checked:text-foreground">
              {option === "deposit" ? messages.savings.deposit : messages.savings.withdraw}
            </span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.amount} errors={messages.errors} htmlFor="savings-amount" label={messages.add.amount}>
          <MoneyInput className={`${inputClass} font-mono`} id="savings-amount" name="amount" />
        </Field>
        <Field error={errors.date} errors={messages.errors} htmlFor="savings-date" label={messages.add.date}>
          <input className={inputClass} defaultValue={today} id="savings-date" name="date" required type="date" />
        </Field>
      </div>

      {funds.length > 1 ? (
        <Field label={messages.savings.fund} errors={messages.errors}>
          <div className="flex flex-wrap gap-2">
            {funds.map((fund, index) => <Chip defaultChecked={index === 0} key={fund.id} label={fund.label} name="fundId" value={fund.id} />)}
          </div>
        </Field>
      ) : (
        <input name="fundId" type="hidden" value={funds[0]?.id} />
      )}

      <Field error={errors.note} errors={messages.errors} htmlFor="savings-note" label={messages.add.note}>
        <input className={inputClass} id="savings-note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={direction === "deposit" ? messages.savings.saveDeposit : messages.savings.saveWithdrawal} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}

/** How many months of spending the emergency fund should cover. */
export function EmergencyMonthsForm({ locale, fundId, coverMonths, messages }: { locale: string; fundId: string; coverMonths: number; messages: Messages }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateSavingsFund, {});
  return (
    <form action={formAction} className="flex items-end gap-3 p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="id" type="hidden" value={fundId} />
      <div className="flex-1">
        <Field error={state.fieldErrors?.coverMonths} errors={messages.errors} htmlFor="cover-months" label={messages.savings.coverMonths}>
          <input className={`${inputClass} font-mono`} defaultValue={coverMonths} id="cover-months" inputMode="numeric" max={24} min={1} name="coverMonths" required type="number" />
        </Field>
      </div>
      <button className="min-h-12 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? messages.common.saving : messages.common.save}
      </button>
    </form>
  );
}

/** Adds a savings goal, or edits one when `initial` is given. */
export function GoalForm({ locale, messages, initial }: { locale: string; messages: Messages; initial?: { id: string; name: string; target: string } }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateSavingsFund : createGoalFund, {});
  const errors = state.fieldErrors ?? {};
  const idPrefix = initial ? `goal-${initial.id}` : "goal-new";
  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.savings.goalName}>
        <input className={inputClass} defaultValue={initial?.name} id={`${idPrefix}-name`} maxLength={40} name="name" placeholder={messages.savings.goalNamePlaceholder} required />
      </Field>
      <Field error={errors.target} errors={messages.errors} htmlFor={`${idPrefix}-target`} label={messages.savings.target}>
        <MoneyInput className={`${inputClass} font-mono`} defaultValue={initial?.target} id={`${idPrefix}-target`} name="target" />
      </Field>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.savings.addGoal} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
