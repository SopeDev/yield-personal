"use client";

import { useActionState } from "react";
import { createIncomeSource, updateIncomeSource } from "@/app/actions/settings";
import type { FormState } from "@/app/actions/form-state";
import type { Messages } from "@/i18n/dictionaries";
import { Chip, Field, inputClass, SubmitButton } from "./form-controls";

/** Adds an income source, or edits one when `initial` is given. `groups` are the groups it can belong to. */
export function IncomeSourceForm({ locale, messages, groups, initial }: {
  locale: string;
  messages: Messages;
  groups: { id: string; name: string }[];
  initial?: { id: string; name: string; groupId: string | null };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(initial ? updateIncomeSource : createIncomeSource, {});
  const errors = state.fieldErrors ?? {};
  const idPrefix = initial ? `source-${initial.id}` : "source-new";

  return (
    <form action={formAction} className="space-y-5 p-4">
      <input name="locale" type="hidden" value={locale} />
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field error={errors.name} errors={messages.errors} htmlFor={`${idPrefix}-name`} label={messages.settings.sourceName}>
        <input className={inputClass} defaultValue={initial?.name} id={`${idPrefix}-name`} maxLength={40} name="name" placeholder={messages.settings.sourceNamePlaceholder} required />
      </Field>
      {groups.length > 0 ? (
        <Field error={errors.groupId} errors={messages.errors} label={messages.settings.sourceGroup}>
          <div className="flex flex-wrap gap-2">
            <Chip defaultChecked={!initial?.groupId} label={messages.settings.noGroup} name="groupId" value="" />
            {groups.map((group) => (
              <Chip defaultChecked={initial?.groupId === group.id} key={group.id} label={group.name} name="groupId" value={group.id} />
            ))}
          </div>
        </Field>
      ) : null}
      {state.error ? <p className="text-sm text-loss" role="alert">{messages.errors[state.error]}</p> : null}
      <SubmitButton label={initial ? messages.common.saveChanges : messages.settings.addSource} pending={pending} pendingLabel={messages.common.saving} />
    </form>
  );
}
