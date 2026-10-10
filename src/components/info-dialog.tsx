"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * A button that opens a read-only dialog: a bottom sheet on phones, centered on larger screens. It reads as a text
 * link unless `triggerClassName` styles it otherwise.
 */
export function InfoDialog({ label, title, closeLabel, children, triggerClassName }: {
  label: ReactNode;
  title: string;
  closeLabel: string;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={triggerClassName ?? "text-left text-primary underline decoration-dotted underline-offset-4 transition hover:decoration-solid"}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {label}
      </button>
      <dialog
        aria-label={title}
        className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full overflow-y-auto text-left max-w-none rounded-t-2xl border border-border bg-surface text-foreground backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-2xl"
        // Clicks on the backdrop land on the dialog element itself.
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
        ref={dialogRef}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border py-2 pr-2 pl-4">
          <h2 className="font-semibold">{title}</h2>
          <button
            aria-label={closeLabel}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
      </dialog>
    </>
  );
}
