import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { DeleteButton } from "./delete-button";

/** A settings subpage's title, under a link back to where it is reached from. */
export function SubpageHeader({ backHref, backLabel, title, description }: { backHref: string; backLabel: string; title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <Link className="-ml-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground" href={backHref}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {description ? <p className="pt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** A row leading to another page, with an optional icon and a hint (like current values) below its title. Used inside a list. */
export function LinkRow({ href, title, hint, icon: Icon }: { href: string; title: string; hint?: string; icon?: LucideIcon }) {
  return (
    <li>
      <Link className="flex min-h-12 items-center gap-3 px-4 py-3 transition hover:bg-background/40" href={href}>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon aria-hidden="true" className="size-4.5" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {hint ? <span className="block truncate text-sm text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

/** The remove or archive action shown under an edit form. */
export function RemoveRow({ action, id, locale, label, confirmMessage }: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  locale: string;
  label: string;
  confirmMessage: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 px-4 pb-4 text-sm text-muted-foreground">
      {label}
      <DeleteButton action={action} confirmMessage={confirmMessage} id={id} label={label} locale={locale} />
    </div>
  );
}
