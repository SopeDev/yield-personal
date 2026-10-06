"use client";

import { useActionState } from "react";
import { clearHistoryStart, setHistoryStart } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Field, inputClass } from "./form-controls";

/** Sets or clears the first month counted in averages and typical daily spending. */
export function HistoryStartForm({ locale, messages, month }: { locale: string; messages: Messages; month: string | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setHistoryStart, {});

  return (
    <div className="space-y-3 p-4">
      <form action={formAction}>
        <input name="locale" type="hidden" value={locale} />
        <Field error={state.fieldErrors?.month} errors={messages.errors} htmlFor="history-start" label={messages.settings.historyStart}>
          <div className="flex gap-2">
            <input className={inputClass} defaultValue={month ?? undefined} id="history-start" name="month" required type="month" />
            <button className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">
              {pending ? messages.common.saving : messages.common.save}
            </button>
          </div>
        </Field>
      </form>
      <p className="text-sm text-muted-foreground">{messages.settings.historyStartHint}</p>
      {month ? (
        <form action={clearHistoryStart}>
          <input name="locale" type="hidden" value={locale} />
          <button className="text-sm font-medium text-loss" type="submit">{messages.settings.historyStartClear}</button>
        </form>
      ) : null}
    </div>
  );
}
