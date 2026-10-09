import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronUp, X } from "lucide-react";
import type { ReactNode } from "react";
import { resetSummaryCard, saveSummaryCard } from "@/app/actions/summary-cards";
import { Card, Section } from "@/components/section";
import { SummaryCard } from "@/components/summary-card";
import { inputClass } from "@/components/input-class";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { loadCashOnHand } from "@/lib/ledger-data";
import { loadMonthView } from "@/lib/month-view";
import { getIncomeGroupsForManagement, getUserSettings } from "@/lib/queries";
import {
  availableStats, cardLayout, isSummaryCardId, MAX_GRID_STATS, monthStatContext, statLabel, statShown, type StatRef, type SummaryCardId, type SummaryCardLayout,
} from "@/lib/stats";
import { currentMonthKey, todayKey } from "@/lib/today";

/** Edits one summary card on the current month: its headline, and which stats its grid shows in what order. */
export default async function SummaryCardEditorPage({ params }: PageProps<"/[locale]/settings/cards/[card]">) {
  const { locale, card } = await params;
  if (!isLocale(locale)) return null;
  if (!isSummaryCardId(card)) notFound();
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const today = todayKey();
  const currentMonth = currentMonthKey();

  const settingsWithCash = getUserSettings(userId).then(async (settings) => ({ settings, cashOnHandCents: await loadCashOnHand(userId, settings.cashCount) }));
  const [view, { settings, cashOnHandCents }, groups] = await Promise.all([
    loadMonthView(userId, currentMonth, currentMonth),
    settingsWithCash,
    getIncomeGroupsForManagement(userId),
  ]);
  const context = monthStatContext({ view, today, settings, cashOnHandCents, incomeGroups: groups });
  const layout = cardLayout(card, settings.summaryCards, context);
  const customized = settings.summaryCards[card] !== undefined;
  const choices = availableStats(context, groups.filter((group) => !group.archivedAt));
  // A stored headline no longer offered (like a per-payday stat after switching to daily) stays selectable.
  const headlineChoices = choices.includes(layout.headline) ? choices : [layout.headline, ...choices];
  const addable = choices.filter((ref) => !layout.grid.includes(ref));
  const label = (ref: StatRef) => statLabel(ref, context, messages);
  const backHref = `/${locale}/${card === "month" ? "month" : "income"}`;

  const moved = (index: number, offset: number) => {
    const grid = [...layout.grid];
    [grid[index], grid[index + offset]] = [grid[index + offset], grid[index]];
    return { ...layout, grid };
  };
  const iconButton = "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-30";

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <Link className="-ml-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground" href={backHref}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          {messages.summary.back}
        </Link>
        <h1 className="font-display text-2xl font-semibold">{card === "month" ? messages.summary.monthTitle : messages.summary.incomeTitle}</h1>
      </div>

      <Section title={messages.summary.preview}>
        <SummaryCard context={context} layout={layout} messages={messages} />
      </Section>

      <Section title={messages.summary.headline}>
        <Card>
          <form action={saveSummaryCard} className="flex gap-2 p-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="card" type="hidden" value={card} />
            {layout.grid.map((ref) => <input key={ref} name="stat" type="hidden" value={ref} />)}
            <select aria-label={messages.summary.headline} className={inputClass} defaultValue={layout.headline} key={layout.headline} name="headline">
              {headlineChoices.map((ref) => <option key={ref} value={ref}>{label(ref)}</option>)}
            </select>
            <button className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">{messages.common.save}</button>
          </form>
        </Card>
      </Section>

      <Section title={messages.summary.stats}>
        <Card>
          {layout.grid.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.summary.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {layout.grid.map((ref, index) => (
                <li className="flex items-center gap-1 py-2 pl-4 pr-2" key={ref}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{label(ref)}</p>
                    {statShown(ref, context) ? null : <p className="truncate text-xs text-muted-foreground">{messages.summary.hiddenNow}</p>}
                  </div>
                  <LayoutForm card={card} locale={locale} next={index > 0 ? moved(index, -1) : layout}>
                    <button aria-label={messages.summary.moveUp} className={iconButton} disabled={index === 0} title={messages.summary.moveUp} type="submit">
                      <ChevronUp aria-hidden="true" className="size-4" />
                    </button>
                  </LayoutForm>
                  <LayoutForm card={card} locale={locale} next={index < layout.grid.length - 1 ? moved(index, 1) : layout}>
                    <button aria-label={messages.summary.moveDown} className={iconButton} disabled={index === layout.grid.length - 1} title={messages.summary.moveDown} type="submit">
                      <ChevronDown aria-hidden="true" className="size-4" />
                    </button>
                  </LayoutForm>
                  <LayoutForm card={card} locale={locale} next={{ ...layout, grid: layout.grid.filter((other) => other !== ref) }}>
                    <button aria-label={messages.summary.remove} className={`${iconButton} hover:text-loss`} title={messages.summary.remove} type="submit">
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </LayoutForm>
                </li>
              ))}
            </ul>
          )}
          {addable.length > 0 && layout.grid.length < MAX_GRID_STATS ? (
            <LayoutForm card={card} className="flex gap-2 border-t border-border p-4" locale={locale} next={layout}>
              <select aria-label={messages.summary.addStat} className={inputClass} defaultValue="" key={layout.grid.join()} name="add" required>
                <option disabled value="">{messages.summary.addStat}</option>
                {addable.map((ref) => <option key={ref} value={ref}>{label(ref)}</option>)}
              </select>
              <button className="min-h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">{messages.summary.add}</button>
            </LayoutForm>
          ) : null}
        </Card>
        <p className="px-1 text-xs text-muted-foreground">{messages.summary.statsHint} {messages.summary.hiddenHint}</p>
      </Section>

      {customized ? (
        <form action={resetSummaryCard}>
          <input name="locale" type="hidden" value={locale} />
          <input name="card" type="hidden" value={card} />
          <button className="min-h-11 text-sm font-medium text-loss" type="submit">{messages.summary.reset}</button>
        </form>
      ) : null}
    </div>
  );
}

/** A form that saves the given layout, posted by `children` (its submit button). */
function LayoutForm({ locale, card, next, children, className }: {
  locale: Locale;
  card: SummaryCardId;
  next: SummaryCardLayout;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action={saveSummaryCard} className={className}>
      <input name="locale" type="hidden" value={locale} />
      <input name="card" type="hidden" value={card} />
      <input name="headline" type="hidden" value={next.headline} />
      {next.grid.map((ref) => <input key={ref} name="stat" type="hidden" value={ref} />)}
      {children}
    </form>
  );
}
