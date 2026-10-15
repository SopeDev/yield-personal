"use client";

import { useActionState, useState } from "react";
import { setFundGrowth } from "@/app/actions/savings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { SALARY_SCHEDULES, type SalarySchedule } from "@/lib/onboarding";
import { MoneyInput } from "./amount-input";
import { Field, inputClass } from "./form-controls";

export type FundGrowthValues = { rate: string; until: string; after: string; deposit: string; schedule: SalarySchedule; days: string; anchor: string };

/** How a savings fund grows: its interest rate (and a promotional one's end and the rate after), and a planned deposit. */
export function FundGrowthForm({ locale, fundId, initial, messages }: { locale: string; fundId: string; initial: FundGrowthValues; messages: Messages }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setFundGrowth, {});
  const [schedule, setSchedule] = useState(initial.schedule);
  const [until, setUntil] = useState(initial.until);
  const errors = state.fieldErrors ?? {};
  const m = messages.savings;
  const id = (name: string) => `${fundId}-${name}`;
  const monthly = schedule === "MONTHLY" || schedule === "TWICE_MONTHLY";

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="id" type="hidden" value={fundId} />
      <Field error={errors.rate} errors={messages.errors} htmlFor={id("rate")} label={m.rate}>
        <input className={`${inputClass} font-mono`} defaultValue={initial.rate} id={id("rate")} inputMode="decimal" name="rate" placeholder="15" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.until} errors={messages.errors} htmlFor={id("until")} label={m.rateUntil}>
          <input className={inputClass} id={id("until")} name="until" onChange={(event) => setUntil(event.target.value)} type="date" value={until} />
        </Field>
        <Field error={errors.after} errors={messages.errors} htmlFor={id("after")} label={m.rateAfter}>
          <input className={`${inputClass} font-mono`} defaultValue={initial.after} disabled={!until} id={id("after")} inputMode="decimal" name="after" placeholder="8.5" />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{m.rateHint}</p>

      <Field error={errors.deposit} errors={messages.errors} htmlFor={id("deposit")} label={m.plannedDeposit}>
        <MoneyInput className={`${inputClass} font-mono`} defaultValue={initial.deposit || undefined} id={id("deposit")} name="deposit" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field error={errors.schedule} errors={messages.errors} htmlFor={id("schedule")} label={m.depositEvery}>
          <select className={inputClass} id={id("schedule")} name="schedule" onChange={(event) => setSchedule(event.target.value as SalarySchedule)} value={schedule}>
            {SALARY_SCHEDULES.map((option) => <option key={option} value={option}>{messages.onboarding.income.schedules[option]}</option>)}
          </select>
        </Field>
        {monthly ? (
          <Field errors={messages.errors} htmlFor={id("days")} label={schedule === "MONTHLY" ? messages.onboarding.income.day : messages.onboarding.income.days}>
            <input className={inputClass} defaultValue={initial.days} id={id("days")} inputMode="numeric" key={schedule} name="days" placeholder={schedule === "MONTHLY" ? "15" : "15, 30"} />
          </Field>
        ) : (
          <Field errors={messages.errors} htmlFor={id("anchor")} label={m.depositFrom}>
            <input className={inputClass} defaultValue={initial.anchor} id={id("anchor")} name="anchor" type="date" />
          </Field>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{m.depositHint}</p>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <button className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? messages.common.saving : messages.common.save}
      </button>
    </form>
  );
}
