"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartLine, PiggyBank, Plus, Settings, Wallet } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function AppShell({ children, locale, labels, version }: {
  children: ReactNode;
  locale: Locale;
  labels: { overview: string; income: string; add: string; settings: string; savings: string; forecast: string; beta: string; feedback: string };
  /** The app's version as shown ("v0.9"), beside the logo with the link to send feedback under it. */
  version: string;
}) {
  const pathname = usePathname();
  // The Overview tab holds the month and year views; Cards are reached from the month's statements and Settings.
  const navigation = [
    { href: `/${locale}/month`, label: labels.overview, icon: CalendarDays, also: [`/${locale}/year`] },
    { href: `/${locale}/forecast`, label: labels.forecast, icon: ChartLine, also: [] },
    { href: `/${locale}/income`, label: labels.income, icon: Wallet, also: [] },
    { href: `/${locale}/savings`, label: labels.savings, icon: PiggyBank, also: [] },
  ];
  const settingsHref = `/${locale}/settings`;
  const addActive = pathname === `/${locale}/add`;
  // Settings stays marked on its subpages.
  const settingsActive = pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/month`}>
              <Image alt="Yield" height={24} priority src="/brand/yield-logo.svg" width={80} />
            </Link>
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[11px] text-subtle">{version} · {labels.beta}</span>
              <Link className="text-[11px] font-medium text-primary" href={`/${locale}/feedback`}>{labels.feedback}</Link>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
          {navigation.slice(0, 2).map(({ also, ...item }) => <NavItem active={pathname === item.href || also.includes(pathname)} key={item.href} {...item} />)}
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
          {navigation.slice(2).map(({ also, ...item }) => <NavItem active={pathname === item.href || also.includes(pathname)} key={item.href} {...item} />)}
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
