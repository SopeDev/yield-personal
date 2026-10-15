"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/actions/account";
import type { Messages } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { inputClass } from "./input-class";

/** Deletes the account once the confirmation word is typed, so it can't happen by a stray tap. */
export function DeleteAccountForm({ locale, labels }: { locale: string; labels: Messages["account"] }) {
  const [state, formAction, pending] = useActionState(deleteAccount, {});
  const confirm = format(labels.confirm, { word: labels.confirmWord });
  return (
    <form action={formAction} className="space-y-3 p-4">
      <input name="locale" type="hidden" value={locale} />
      <label className="block space-y-2">
        <span className="text-sm font-medium text-muted-foreground">{confirm}</span>
        <input autoCapitalize="characters" autoComplete="off" className={inputClass} name="confirm" placeholder={labels.confirmWord} required />
      </label>
      {state.mismatch ? <p className="text-sm text-loss" role="alert">{format(labels.mismatch, { word: labels.confirmWord })}</p> : null}
      <button className="min-h-12 w-full rounded-xl bg-loss px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "…" : labels.button}
      </button>
    </form>
  );
}
