"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { confirmPlannedDeposit, quickConfirmPlannedDeposit } from "@/app/actions/savings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { MoneyInput } from "./amount-input";
import { Field, inputClass } from "./form-controls";
import { Money } from "./money";

/**
 * A planned deposit into savings on the month view: made (with what went in), or still to make. One tap on the check
 * records it as planned; opening the row records a different amount or day. Rows of later months only show the plan.
 */
export function PlannedDepositRow({ locale, messages, fundId, fundName, currency, date, dateLabel, plannedCents, made, overdue, confirmable }: {
  locale: string;
  messages: Messages;
  fundId: string;
  fundName: string;
  currency: string;
  date: string;
  dateLabel: string;
  plannedCents: number;
  made: { dateLabel: string; amountCents: number } | null;
  overdue: boolean;
  confirmable: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(confirmPlannedDeposit, {});
  const m = messages.month;
  const dot = <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-sky-400" />;
  const title = <p className="truncate font-medium">{fundName}</p>;

  if (made) {
    return (
      <li className="flex items-center gap-3 py-3 pl-4 pr-3">
        {dot}
        <div className="min-w-0 flex-1">
          {title}
          <p className="truncate text-sm text-muted-foreground">{format(m.depositedOn, { date: made.dateLabel })}</p>
        </div>
        <Money cents={made.amountCents} currency={currency} />
        <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-400">{m.deposited}</span>
      </li>
    );
  }

  const header = (
    <>
      {dot}
      <div className="min-w-0 flex-1">
        {title}
        <p className={cn("truncate text-sm text-muted-foreground", overdue && "font-medium text-warning")}>{format(m.depositOn, { date: dateLabel })}</p>
      </div>
      <Money cents={plannedCents} className="text-muted-foreground" currency={currency} />
    </>
  );
  if (!confirmable) return <li className="flex items-center gap-3 py-3 pl-4 pr-3">{header}</li>;
  const quickId = `deposit-${fundId}-${date}`;
  return (
    <li>
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3 pl-4 pr-3">
          {header}
          <button
            aria-label={m.markDeposited}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-subtle transition hover:border-sky-400 hover:text-sky-400"
            form={quickId}
            title={m.markDeposited}
            type="submit"
          >
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          </button>
        </summary>
        <form action={formAction} className="space-y-4 border-t border-border bg-background/40 p-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="fundId" type="hidden" value={fundId} />
          <input name="planned" type="hidden" value={date} />
          <div className="grid grid-cols-2 gap-3">
            <Field error={state.fieldErrors?.amount} errors={messages.errors} htmlFor={`${quickId}-amount`} label={m.depositAmount}>
              <MoneyInput className={`${inputClass} font-mono`} defaultValue={(plannedCents / 100).toFixed(2)} id={`${quickId}-amount`} name="amount" />
            </Field>
            <Field error={state.fieldErrors?.date} errors={messages.errors} htmlFor={`${quickId}-date`} label={messages.add.date}>
              <input className={inputClass} defaultValue={date} id={`${quickId}-date`} name="date" type="date" />
            </Field>
          </div>
          <button className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
            {pending ? messages.common.saving : m.recordDeposit}
          </button>
        </form>
      </details>
      <form action={quickConfirmPlannedDeposit} hidden id={quickId}>
        <input name="locale" type="hidden" value={locale} />
        <input name="fundId" type="hidden" value={fundId} />
        <input name="planned" type="hidden" value={date} />
      </form>
    </li>
  );
}
