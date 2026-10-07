"use client";

import { useActionState, useState } from "react";
import { setIncomeRhythm } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import type { IncomeRhythmKind } from "@/lib/income-rhythm";
import { Chip, Field, inputClass } from "./form-controls";

/** Sets when income arrives; weekly rhythms ask for any payday, and days of the month ask for the days. */
export function IncomeRhythmForm({ locale, messages, kind, anchor, days, today }: {
  locale: string;
  messages: Messages;
  kind: IncomeRhythmKind;
  anchor: string | null;
  days: number[];
  /** Today as "YYYY-MM-DD", the default payday. */
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setIncomeRhythm, {});
  const [selected, setSelected] = useState(kind);
  const labels: Record<IncomeRhythmKind, string> = {
    DAILY: messages.settings.rhythmDaily,
    WEEKLY: messages.settings.rhythmWeekly,
    BIWEEKLY: messages.settings.rhythmBiweekly,
    MONTH_DAYS: messages.settings.rhythmMonthDays,
  };

  return (
    <form action={formAction} className="space-y-4 p-4">
      <input name="locale" type="hidden" value={locale} />
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as IncomeRhythmKind[]).map((option) => (
          <Chip checked={selected === option} key={option} label={labels[option]} name="kind" onChange={() => setSelected(option)} value={option} />
        ))}
      </div>
      {selected === "WEEKLY" || selected === "BIWEEKLY" ? (
        <Field error={state.fieldErrors?.anchor} errors={messages.errors} htmlFor="rhythm-anchor" label={messages.settings.rhythmAnchor}>
          <input className={inputClass} defaultValue={anchor ?? today} id="rhythm-anchor" name="anchor" required type="date" />
          <p className="text-sm text-muted-foreground">{messages.settings.rhythmAnchorHint}</p>
        </Field>
      ) : null}
      {selected === "MONTH_DAYS" ? (
        <Field error={state.fieldErrors?.days} errors={messages.errors} htmlFor="rhythm-days" label={messages.settings.rhythmDays}>
          <input
            className={inputClass}
            defaultValue={days.join(", ")}
            id="rhythm-days"
            inputMode="numeric"
            name="days"
            placeholder={messages.settings.rhythmDaysPlaceholder}
            required
          />
          <p className="text-sm text-muted-foreground">{messages.settings.rhythmDaysHint}</p>
        </Field>
      ) : null}
      <p className="text-sm text-muted-foreground">{messages.settings.incomeRhythmHint}</p>
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <button className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
        {pending ? messages.common.saving : messages.common.save}
      </button>
    </form>
  );
}
