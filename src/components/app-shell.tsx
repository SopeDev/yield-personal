"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CreditCard, PiggyBank, Plus, Settings, Table2, Wallet } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function AppShell({ children, locale, labels }: {
  children: ReactNode;
  locale: Locale;
  labels: { month: string; year: string; income: string; add: string; cards: string; settings: string; savings: string };
}) {
  const pathname = usePathname();
  const navigation = [
    { href: `/${locale}/month`, label: labels.month, icon: CalendarDays },
    { href: `/${locale}/year`, label: labels.year, icon: Table2 },
    { href: `/${locale}/income`, label: labels.income, icon: Wallet },
    { href: `/${locale}/cards`, label: labels.cards, icon: CreditCard },
  ];
  const settingsHref = `/${locale}/settings`;
  const savingsHref = `/${locale}/savings`;
  const addActive = pathname === `/${locale}/add`;
  // Settings stays marked on its subpages.
  const settingsActive = pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <Link href={`/${locale}/month`}>
            <Image alt="Yield" height={24} priority src="/brand/yield-logo.svg" width={80} />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              aria-current={pathname === savingsHref ? "page" : undefined}
              aria-label={labels.savings}
              className={cn("flex size-10 items-center justify-center rounded-full transition hover:bg-surface", pathname === savingsHref ? "text-primary" : "text-muted-foreground")}
              href={savingsHref}
            >
              <PiggyBank aria-hidden="true" className="size-5" />
            </Link>
            <Link
              aria-current={settingsActive ? "page" : undefined}
              aria-label={labels.settings}
              className={cn("flex size-10 items-center justify-center rounded-full transition hover:bg-surface", settingsActive ? "text-primary" : "text-muted-foreground")}
              href={settingsHref}
            >
              <Settings aria-hidden="true" className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-5">{children}</main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {navigation.slice(0, 2).map((item) => <NavItem active={pathname === item.href} key={item.href} {...item} />)}
          <Link
            aria-current={addActive ? "page" : undefined}
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-primary"
            href={`/${locale}/add`}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
            </span>
            <span>{labels.add}</span>
          </Link>
          {navigation.slice(2).map((item) => <NavItem active={pathname === item.href} key={item.href} {...item} />)}
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
      href={href}
    >
      <Icon aria-hidden="true" className="size-5" />
      <span>{label}</span>
    </Link>
  );
}
