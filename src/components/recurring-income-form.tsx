"use client";

import { useActionState, useState } from "react";
import { createRecurringIncome, updateRecurringIncome } from "@/app/actions/recurring-income";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import type { IncomeRhythmKind } from "@/lib/income-rhythm";
import { findSourceByName, MAX_SOURCE_NAME_LENGTH, NEW_SOURCE } from "@/lib/income-sources";
import { MoneyInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

type ScheduleKind = Exclude<IncomeRhythmKind, "DAILY">;

/** Values of a recurring income being edited, or the defaults for a new one (from the income rhythm). */
export type RecurringIncomeInitial = {
  id?: string;
  sourceId?: string;
  amount?: string;
  currency?: string;
  kind: ScheduleKind;
  anchor: string;
  days: number[];
};

/**
 * Creates a recurring income, or edits one when `initial` has an id. Its schedule is weekly or every two weeks from
 * any payday, or days of the month. A new source can be named in place; a name matching a source uses that one.
 */
export function RecurringIncomeForm({ locale, sources, currencies, messages, initial }: {
  locale: string;
  sources: { id: string; name: string }[];
  /** Cash wallet currencies, the main one first; asked only when there are several. */
  currencies: string[];
  messages: Messages;
  initial: RecurringIncomeInitial;
}) {
  const isEdit = initial.id !== undefined;
  const [state, formAction, pending] = useActionState<FormState, FormData>(isEdit ? updateRecurringIncome : createRecurringIncome, {});
  const [kind, setKind] = useState<ScheduleKind>(initial.kind);
  const [sourceChoice, setSourceChoice] = useState(initial.sourceId ?? sources[0]?.id ?? NEW_SOURCE);
  const [sourceName, setSourceName] = useState("");
  const matchingSource = sourceChoice === NEW_SOURCE ? findSourceByName(sources, sourceName) : undefined;
  const errors = state.fieldErrors ?? {};
  const idPrefix = initial.id ? `recurring-income-${initial.id}` : "recurring-income-new";
  const kinds: Record<ScheduleKind, string> = {
    WEEKLY: messages.settings.rhythmWeekly,
    BIWEEKLY: messages.settings.rhythmBiweekly,
    MONTH_DAYS: messages.settings.rhythmMonthDays,
  };

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial.id ? <input name="id" type="hidden" value={initial.id} /> : null}

      {sources.length > 0 ? (
        <Field error={errors.sourceId} errors={messages.errors} label={messages.add.source}>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <Chip checked={sourceChoice === source.id} key={source.id} label={source.name} name="sourceId" onChange={() => setSourceChoice(source.id)} value={source.id} />
            ))}
            <Chip checked={sourceChoice === NEW_SOURCE} label={`+ ${messages.add.newSource}`} name="sourceId" onChange={() => setSourceChoice(NEW_SOURCE)} value={NEW_SOURCE} />
          </div>
        </Field>
      ) : <input name="sourceId" type="hidden" value={NEW_SOURCE} />}
      {sourceChoice === NEW_SOURCE ? (
        <Field error={errors.sourceName} errors={messages.errors} htmlFor={`${idPrefix}-source`} label={messages.add.sourceName}>
          <input
            autoComplete="off"
            className={inputClass}
            id={`${idPrefix}-source`}
            maxLength={MAX_SOURCE_NAME_LENGTH}
            name="sourceName"
            onChange={(event) => setSourceName(event.target.value)}
            placeholder={messages.add.sourceNamePlaceholder}
            required
            value={sourceName}
          />
          {matchingSource ? <p className="text-sm text-muted-foreground">{format(messages.add.sourceExists, { name: matchingSource.name })}</p> : null}
        </Field>
      ) : null}

      <Field error={errors.amount} errors={messages.errors} htmlFor={`${idPrefix}-amount`} label={messages.add.amount}>
        <MoneyInput className={`${inputClass} font-mono`} defaultValue={initial.amount} id={`${idPrefix}-amount`} name="amount" />
      </Field>

      {currencies.length > 1 ? (
        <Field error={errors.currency} errors={messages.errors} label={messages.add.currency}>
          <div className="flex flex-wrap gap-2">
            {currencies.map((code) => <Chip defaultChecked={code === (initial.currency ?? currencies[0])} key={code} label={code} name="currency" value={code} />)}
          </div>
        </Field>
      ) : <input name="currency" type="hidden" value={initial.currency ?? currencies[0]} />}

      <Field error={errors.kind} errors={messages.errors} label={messages.recurring.schedule}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(kinds) as ScheduleKind[]).map((option) => (
            <Chip checked={kind === option} key={option} label={kinds[option]} name="kind" onChange={() => setKind(option)} value={option} />
          ))}
        </div>
      </Field>
      {kind === "MONTH_DAYS" ? (
        <Field error={errors.days} errors={messages.errors} htmlFor={`${idPrefix}-days`} label={messages.settings.rhythmDays}>
          <input
            className={inputClass}
            defaultValue={initial.days.join(", ")}
            id={`${idPrefix}-days`}
            inputMode="numeric"
            name="days"
            placeholder={messages.settings.rhythmDaysPlaceholder}
            required
          />
          <p className="text-sm text-muted-foreground">{messages.settings.rhythmDaysHint}</p>
        </Field>
      ) : (
        <Field error={errors.anchor} errors={messages.errors} htmlFor={`${idPrefix}-anchor`} label={messages.settings.rhythmAnchor}>
          <input className={inputClass} defaultValue={initial.anchor} id={`${idPrefix}-anchor`} name="anchor" required type="date" />
          <p className="text-sm text-muted-foreground">{messages.recurring.firstPaydayHint}</p>
        </Field>
      )}

      {isEdit ? <p className="text-sm text-muted-foreground">{messages.recurring.incomeEditHint}</p> : null}
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={isEdit ? messages.recurring.saveChanges : messages.recurring.addIncome} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
