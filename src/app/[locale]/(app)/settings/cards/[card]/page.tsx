import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { resetSummaryCard, saveSummaryCard } from "@/app/actions/summary-cards";
import { Card, Section } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { SummaryCard } from "@/components/summary-card";
import { inputClass } from "@/components/input-class";
import { isLocale, type Locale } from "@/i18n/config";
import { format, getDictionary, type Messages } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { categoryLabel } from "@/lib/categories";
import { getCashWallets } from "@/lib/ledger-data";
import { loadCash, loadMonthView, loadSavingsSnapshot } from "@/lib/month-view";
import { getActiveCategories, getActiveIncomeSources, getActiveItems, getIncomeGroupsForManagement, getStatNames, getUserSettings } from "@/lib/queries";
import {
  availableStats, cardLayout, INCOME_FRAMES, INCOME_PERS, isSummaryCardId, MAX_GRID_STATS, monthStatContext, SPENDING_PERIODS, STAT_BUILDERS, statBuilderValues,
  statDescription, statLabel, statShown, type StatBuilder, type StatBuilderValues, type StatRef, type SummaryCardId, type SummaryCardLayout,
} from "@/lib/stats";
import { currentMonthKey, todayKey } from "@/lib/today";

/** What the builders offer to choose from: categories and items to spend on, income groups and sources to earn from. */
type BuilderChoices = {
  categories: { id: string; label: string }[];
  items: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  sources: { id: string; name: string }[];
};

/**
 * Edits one summary card on the current month: its headline, which stats its grid shows in what order, and the
 * settings of the stats built from them (spending and income, and their averages).
 */
export default async function SummaryCardEditorPage({ params }: PageProps<"/[locale]/settings/cards/[card]">) {
  const { locale, card } = await params;
  if (!isLocale(locale)) return null;
  if (!isSummaryCardId(card)) notFound();
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const today = todayKey();
  const currentMonth = currentMonthKey();

  const settingsWithCash = Promise.all([getUserSettings(userId), getCashWallets(userId)])
    .then(async ([settings, wallets]) => {
      const [cash, savings] = await Promise.all([loadCash(userId, wallets, settings.currency), loadSavingsSnapshot(userId, currentMonth, settings.currency)]);
      return { settings, ...cash, savings };
    });
  const [view, { settings, cashOnHandCents, cashOnHandParts, otherCash, savings }, groups, statNames, categories, items, sources] = await Promise.all([
    loadMonthView(userId, currentMonth, currentMonth),
    settingsWithCash,
    getIncomeGroupsForManagement(userId),
    getStatNames(userId),
    getActiveCategories(userId),
    getActiveItems(userId),
    getActiveIncomeSources(userId),
  ]);
  const context = monthStatContext({ view, today, settings, cashOnHandCents, cashOnHandParts, otherCash, savings, incomeGroups: groups, statNames });
  const layout = cardLayout(card, settings.summaryCards, context);
  const customized = settings.summaryCards[card] !== undefined;
  const choices = availableStats(context);
  // A stored headline no longer offered (like a per-payday stat after switching to daily) stays selectable.
  const headlineChoices = choices.includes(layout.headline) ? choices : [layout.headline, ...choices];
  const addable = choices.filter((ref) => !layout.grid.includes(ref));
  const label = (ref: StatRef) => statLabel(ref, context, messages);
  const description = (ref: StatRef) => statDescription(ref, context, messages);
  const backHref = `/${locale}/${card === "month" ? "month" : "income"}`;
  const builderChoices: BuilderChoices = {
    categories: categories.map((category) => ({ id: category.id, label: categoryLabel(category, messages.categories) })),
    items,
    groups: groups.filter((group) => !group.archivedAt),
    sources,
  };

  const moved = (index: number, offset: number) => {
    const grid = [...layout.grid];
    [grid[index], grid[index + offset]] = [grid[index + offset], grid[index]];
    return { ...layout, grid };
  };
  const iconButton = "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-30";
  const hiddenNow = (ref: StatRef) => (statShown(ref, context) ? null : <p className="truncate text-xs font-medium text-muted-foreground">{messages.summary.hiddenNow}</p>);

  return (
    <div className="space-y-7">
      <SubpageHeader backHref={backHref} backLabel={messages.summary.back} title={card === "month" ? messages.summary.monthTitle : messages.summary.incomeTitle} />

      <Section title={messages.summary.preview}>
        <SummaryCard context={context} layout={layout} locale={locale} messages={messages} />
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
              {layout.grid.map((ref, index) => {
                const values = statBuilderValues(ref);
                return (
                  <li key={ref}>
                    <div className="flex items-center gap-1 py-2 pl-4 pr-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{label(ref)}</p>
                        <p className="text-xs text-muted-foreground">{description(ref)}</p>
                        {hiddenNow(ref)}
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
                    </div>
                    {values ? (
                      // A stat built from settings changes them in place, keeping its spot on the card.
                      <details className="px-4 pb-2">
                        <summary className="cursor-pointer list-none text-sm font-medium text-primary">{messages.summary.changeSettings}</summary>
                        <BuilderForm card={card} choices={builderChoices} layout={layout} locale={locale} messages={messages} replace={ref} values={values} />
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <p className="px-1 text-xs text-muted-foreground">{messages.summary.statsHint} {messages.summary.hiddenHint}</p>
      </Section>

      {/* Listed with what each stat is, so one can be chosen before adding it. */}
      {layout.grid.length < MAX_GRID_STATS ? (
        <Section title={messages.summary.addStat}>
          <Card>
            <ul className="divide-y divide-border">
              {/* Stats built from settings: tapping one opens them, and adding saves it with them. */}
              {STAT_BUILDERS.map((builder) => (
                <li key={builder}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 py-2 pl-4 pr-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{messages.summary.builders[builder].title}</p>
                        <p className="text-xs text-muted-foreground">{messages.summary.builders[builder].hint}</p>
                      </div>
                      <span className="flex size-11 items-center justify-center rounded-full text-primary transition group-open:rotate-45">
                        <Plus aria-hidden="true" className="size-5" />
                      </span>
                    </summary>
                    <div className="px-4 pb-4">
                      <BuilderForm builder={builder} card={card} choices={builderChoices} layout={layout} locale={locale} messages={messages} />
                    </div>
                  </details>
                </li>
              ))}
              {addable.map((ref) => (
                <li className="flex items-center gap-2 py-2 pl-4 pr-2" key={ref}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{label(ref)}</p>
                    <p className="text-xs text-muted-foreground">{description(ref)}</p>
                    {hiddenNow(ref)}
                  </div>
                  <LayoutForm card={card} locale={locale} next={{ ...layout, grid: [...layout.grid, ref] }}>
                    <button
                      aria-label={format(messages.summary.addNamed, { stat: label(ref) })}
                      className="flex size-11 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"
                      title={format(messages.summary.addNamed, { stat: label(ref) })}
                      type="submit"
                    >
                      <Plus aria-hidden="true" className="size-5" />
                    </button>
                  </LayoutForm>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

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

/**
 * A configurable stat's settings: what it's about and over what time. Adds the stat it makes to the card, or, with
 * `replace`, puts it in the place of that stat.
 */
function BuilderForm({ locale, card, layout, messages, choices, builder, values, replace }: {
  locale: Locale;
  card: SummaryCardId;
  layout: SummaryCardLayout;
  messages: Messages;
  choices: BuilderChoices;
  builder?: StatBuilder;
  values?: StatBuilderValues;
  replace?: StatRef;
}) {
  const kind = values?.builder ?? builder ?? "averageSpending";
  const m = messages.summary;
  const field = (name: string, title: string, defaultValue: string, options: ReactNode) => (
    <label className="block space-y-1">
      <span className="text-sm text-muted-foreground">{title}</span>
      <select className={inputClass} defaultValue={defaultValue} name={name}>{options}</select>
    </label>
  );
  const spendingScope = field("scope", m.on, values?.scope ?? "all", (
    <>
      <option value="all">{m.everything}</option>
      <optgroup label={m.categoriesGroup}>
        {choices.categories.map((category) => <option key={category.id} value={`category.${category.id}`}>{category.label}</option>)}
      </optgroup>
      {choices.items.length > 0 ? (
        <optgroup label={m.itemsGroup}>
          {choices.items.map((item) => <option key={item.id} value={`item.${item.id}`}>{item.name}</option>)}
        </optgroup>
      ) : null}
    </>
  ));
  const incomeSource = field("source", m.from, values?.source ?? "all", (
    <>
      <option value="all">{m.allIncome}</option>
      {choices.groups.length > 0 ? (
        <optgroup label={m.groupsGroup}>
          {choices.groups.map((group) => <option key={group.id} value={`group.${group.id}`}>{group.name}</option>)}
        </optgroup>
      ) : null}
      {choices.sources.length > 0 ? (
        <optgroup label={m.sourcesGroup}>
          {choices.sources.map((source) => <option key={source.id} value={`source.${source.id}`}>{source.name}</option>)}
        </optgroup>
      ) : null}
    </>
  ));
  const basis = field("basis", m.basis, values?.basis ?? "gross", (
    <>
      <option value="gross">{m.gross}</option>
      <option value="net">{m.netOption}</option>
    </>
  ));

  return (
    <form action={saveSummaryCard} className="space-y-3 pt-2">
      <input name="locale" type="hidden" value={locale} />
      <input name="card" type="hidden" value={card} />
      <input name="headline" type="hidden" value={layout.headline} />
      {layout.grid.map((ref) => <input key={ref} name="stat" type="hidden" value={ref} />)}
      <input name="builder" type="hidden" value={kind} />
      {replace ? <input name="replace" type="hidden" value={replace} /> : null}
      {kind === "averageSpending" || kind === "spending" ? spendingScope : incomeSource}
      {kind === "income" || kind === "averageIncome" ? basis : null}
      {kind === "averageSpending"
        ? field("period", m.per, values?.period ?? "week", SPENDING_PERIODS.map((period) => <option key={period} value={period}>{m.perOptions[period]}</option>))
        : null}
      {kind === "income"
        ? field("frame", m.when, values?.frame ?? "month", INCOME_FRAMES.map((frame) => <option key={frame} value={frame}>{m.current[frame]}</option>))
        : null}
      {kind === "averageIncome"
        ? field("per", m.per, values?.per ?? "workday", INCOME_PERS.map((per) => <option key={per} value={per}>{per === "workday" ? m.workdayOption : m.perOptions[per]}</option>))
        : null}
      <button className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" type="submit">{replace ? messages.common.save : m.add}</button>
    </form>
  );
}
