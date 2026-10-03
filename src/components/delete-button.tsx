"use client";

import { Trash2 } from "lucide-react";

export function DeleteButton({ action, id, locale, label, confirmMessage }: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  locale: string;
  label: string;
  confirmMessage: string;
}) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(confirmMessage)) event.preventDefault(); }}>
      <input name="id" type="hidden" value={id} />
      <input name="locale" type="hidden" value={locale} />
      <button aria-label={label} className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-loss" type="submit">
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}
