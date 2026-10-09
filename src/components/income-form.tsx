"use client";

import { useActionState, useState } from "react";
import { createIncome, updateIncome } from "@/app/actions/entries";
import type { FormState } from "@/app/actions/form-state";
import { format, type Messages } from "@/i18n/dictionaries";
import { findSourceByName, MAX_SOURCE_NAME_LENGTH, NEW_SOURCE } from "@/lib/income-sources";
import { AmountInput } from "./amount-input";
import { Chip, Field, inputClass, SubmitButton, submitWithoutReset, useClientId } from "./form-controls";

/** Values of an existing income entry being edited. */
export type IncomeInitial = { id: string; amount: string; sourceId: string; date: string; note: string; currency: string };

/**
 * Records new income, or edits an entry when `initial` is given. With cash wallets in several currencies
 * (`currencies`, the main one first), it asks which one the income came in; it lands in that wallet. A new source
 * can be named in place (in one of `groups`, if any); a name matching an existing source uses that one.
 */
export function IncomeForm({ locale, today, sources, groups = [], currencies, messages, initial, amount, onAmountChange }: {
  locale: string;
  today: string;
  sources: { id: string; name: string }[];
  /** Active income groups a new source may join. */
  groups?: { id: string; name: string }[];
  currencies: string[];
  messages: Messages;
  initial?: IncomeInitial;
  /** An amount kept by the parent, such as quick add sharing it between the expense and income tabs. */
  amount?: string;
  onAmountChange?: (amount: string) => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateIncome : createIncome, {});
  const clientId = useClientId();
  const errors = state.fieldErrors ?? {};
  const [currency, setCurrency] = useState(initial?.currency ?? currencies[0]);
  const [sourceChoice, setSourceChoice] = useState(initial?.sourceId ?? sources[0]?.id ?? NEW_SOURCE);
  const [sourceName, setSourceName] = useState("");
  const matchingSource = sourceChoice === NEW_SOURCE ? findSourceByName(sources, sourceName) : undefined;

  return (
    <form className="space-y-6" onSubmit={(event) => submitWithoutReset(event, formAction, initial ? undefined : clientId())}>
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.amount} errors={messages.errors} htmlFor="amount" label={messages.add.amount}>
        <AmountInput autoFocus={!initial} currency={currency} defaultValue={initial?.amount} onChange={onAmountChange} value={amount} />
      </Field>

      {currencies.length > 1 ? (
        <Field error={errors.currency} errors={messages.errors} label={messages.add.currency}>
          <div className="flex flex-wrap gap-2">
            {currencies.map((code) => <Chip checked={code === currency} key={code} label={code} name="currency" onChange={() => setCurrency(code)} value={code} />)}
          </div>
        </Field>
      ) : <input name="currency" type="hidden" value={currency} />}

      {/* With no sources yet, the form goes straight to naming the first one. */}
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
        <>
          <Field error={errors.sourceName} errors={messages.errors} htmlFor="source-name" label={messages.add.sourceName}>
            <input
              autoComplete="off"
              className={inputClass}
              id="source-name"
              maxLength={MAX_SOURCE_NAME_LENGTH}
              name="sourceName"
              onChange={(event) => setSourceName(event.target.value)}
              placeholder={messages.add.sourceNamePlaceholder}
              required
              value={sourceName}
            />
            {matchingSource ? <p className="text-sm text-muted-foreground">{format(messages.add.sourceExists, { name: matchingSource.name })}</p> : null}
          </Field>
          {groups.length > 0 && !matchingSource ? (
            <Field error={errors.sourceGroupId} errors={messages.errors} label={messages.settings.sourceGroup}>
              <div className="flex flex-wrap gap-2">
                <Chip defaultChecked label={messages.settings.noGroup} name="sourceGroupId" value="" />
                {groups.map((group) => <Chip key={group.id} label={group.name} name="sourceGroupId" value={group.id} />)}
              </div>
            </Field>
          ) : null}
        </>
      ) : null}

      <Field error={errors.date} errors={messages.errors} htmlFor="date" label={messages.add.date}>
        <input className={inputClass} defaultValue={initial?.date ?? today} id="date" name="date" required type="date" />
      </Field>

      <Field error={errors.note} errors={messages.errors} htmlFor="note" label={messages.add.note}>
        <input className={inputClass} defaultValue={initial?.note} id="note" maxLength={200} name="note" placeholder={messages.add.notePlaceholder} />
      </Field>

      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.add.saveIncome} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
