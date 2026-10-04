import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A small button that submits a server action with hidden fields (move up/down, restore, and similar). */
export function ActionButton({ action, fields, label, children, disabled, className }: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <button
        aria-label={label}
        className={cn("flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-30", className)}
        disabled={disabled}
        title={label}
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}
