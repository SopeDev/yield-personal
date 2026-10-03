import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** A form button that flips an item between paid and unpaid. */
export function PaidToggle({ action, fields, paid, labels }: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  paid: boolean;
  labels: { paid: string; markPaid: string; markUnpaid: string };
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <input name="paid" type="hidden" value={paid ? "false" : "true"} />
      <button
        aria-label={paid ? labels.markUnpaid : labels.markPaid}
        className={cn(
          "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
          paid ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
        )}
        type="submit"
      >
        {paid ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
        {paid ? labels.paid : labels.markPaid}
      </button>
    </form>
  );
}

export function StatusBadge({ paid, labels }: { paid: boolean; labels: { paid: string; unpaid: string } }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", paid ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning")}>
      {paid ? labels.paid : labels.unpaid}
    </span>
  );
}
