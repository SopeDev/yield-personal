import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { dismissSetup } from "@/app/actions/onboarding";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { SetupChecklist } from "@/lib/onboarding";

/**
 * After the setup wizard, what's left to set up, each step linking to where it's done and ticked off once it is.
 * It goes away when every step is done, or for good when hidden.
 */
export function SetupChecklistCard({ checklist, locale, labels }: { checklist: SetupChecklist; locale: Locale; labels: Messages["setup"] }) {
  const steps = [
    { done: checklist.cash, label: labels.cash, href: `/${locale}/settings/money` },
    { done: checklist.bills, label: labels.bills, href: `/${locale}/settings/recurring-payments` },
    { done: checklist.cards, label: labels.cards, href: `/${locale}/settings/money` },
    { done: checklist.expense, label: labels.expense, href: `/${locale}/add` },
  ];
  return (
    <section className="rounded-2xl border border-primary/40 bg-primary/5">
      <div className="flex items-center justify-between gap-3 py-2 pl-4 pr-2">
        <h2 className="font-semibold">{labels.title}</h2>
        <form action={dismissSetup}>
          <input name="locale" type="hidden" value={locale} />
          <button className="min-h-11 px-3 text-sm font-medium text-muted-foreground" type="submit">{labels.dismiss}</button>
        </form>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {steps.map((step) => (
          <li key={step.label}>
            <Link className="flex min-h-12 items-center gap-3 px-4 text-sm" href={step.href}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", step.done ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {step.done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className={cn("flex-1", step.done && "text-muted-foreground line-through")}>{step.label}</span>
              {step.done ? null : <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
