import { startTransition, useRef, type FormEvent, type ReactNode } from "react";
import type { ErrorKey, Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";

export { inputClass } from "./input-class";

export function Field({ label, htmlFor, error, errors, children }: {
  label: string;
  htmlFor?: string;
  error?: ErrorKey;
  errors: Messages["errors"];
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {htmlFor ? (
        <label className="block text-sm font-medium text-muted-foreground" htmlFor={htmlFor}>{label}</label>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}
      {children}
      {error ? <p className="text-sm text-loss" role="alert">{errors[error]}</p> : null}
    </div>
  );
}

/** A radio input rendered as a tappable chip. */
export function Chip({ name, value, label, color, checked, defaultChecked, onChange }: {
  name: string;
  value: string;
  label: string;
  color?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input checked={checked} className="peer sr-only" defaultChecked={defaultChecked} name={name} onChange={onChange} type="radio" value={value} />
      <span
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium transition",
          "peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-primary",
        )}
      >
        {color ? <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: color }} /> : null}
        {label}
      </span>
    </label>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Submits through the action without React's automatic form reset, so a rejected entry keeps what was typed.
 * Successful entries redirect away, so there is nothing to reset. A `clientId` (kept for the life of the form)
 * makes repeated submissions of the same new entry, like a double tap, record it only once.
 */
export function submitWithoutReset(event: FormEvent<HTMLFormElement>, formAction: (formData: FormData) => void, clientId?: string) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  if (clientId) formData.set("clientId", clientId);
  startTransition(() => formAction(formData));
}

/**
 * A stable id for one new entry, created on first submit so server and client renders stay identical.
 * Forms that stay on the page pass their last `savedAt`, so each saved entry gets a fresh id.
 */
export function useClientId(savedAt?: number) {
  const ref = useRef<{ id: string; savedAt?: number } | null>(null);
  return () => {
    if (!ref.current || ref.current.savedAt !== savedAt) ref.current = { id: crypto.randomUUID(), savedAt };
    return ref.current.id;
  };
}
