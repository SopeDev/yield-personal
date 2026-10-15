"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { inputClass } from "@/components/input-class";
import { locales, type Locale } from "@/i18n/config";
import { format, type Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { CURRENCIES, formatCents, parseAmountToCents } from "@/lib/money";
import {
  BILL_PRESETS, emptyAnswers, MAX_ONBOARDING_BILLS, MAX_ONBOARDING_CARDS, planOnboarding, SALARY_SCHEDULES, VARIABLE_BILLS,
  type BillPreset, type OnboardingAnswers, type SalarySchedule,
} from "@/lib/onboarding";

const STEPS = ["welcome", "income", "cash", "cards", "bills", "spending", "done"] as const;
type Step = (typeof STEPS)[number];

type CardDraft = { key: number; name: string; closingDay: string; paymentDays: string };
/** A bill as being filled in: a preset's name comes from the preset; `card` is a card's key, or null for cash. */
type BillDraft = { key: number; preset: BillPreset | null; name: string; amount: string; day: string; card: number | null };
type SalaryDraft = { name: string; amount: string; schedule: SalarySchedule; days: string; anchor: string };

/**
 * The setup wizard: one question a screen, each optional, with every answer kept here until the last screen saves
 * them all at once, so going back or skipping never leaves anything half saved. Without `save` it's the preview,
 * which goes through the same screens and saves nothing.
 */
export function OnboardingWizard({ locale, labels: m, categories, currency: initialCurrency, today, basePath, save }: {
  locale: Locale;
  labels: Messages["onboarding"];
  /** The everyday categories, to estimate monthly spending on. */
  categories: { id: string; label: string }[];
  currency: string;
  /** Today as "YYYY-MM-DD", for a weekly salary's payday. */
  today: string;
  /** The wizard's path after the locale ("onboarding" or "onboarding/preview"), for switching language. */
  basePath: string;
  save?: (answers: OnboardingAnswers, locale: Locale) => Promise<{ error: string } | undefined>;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [currency, setCurrency] = useState(initialCurrency);
  const [salaryOn, setSalaryOn] = useState(false);
  const [salary, setSalary] = useState<SalaryDraft>({ name: m.income.salaryNameDefault, amount: "", schedule: "TWICE_MONTHLY", days: "15, 30", anchor: today });
  const [variableIncome, setVariableIncome] = useState(false);
  const [incomeEstimate, setIncomeEstimate] = useState("");
  const [spending, setSpending] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("");
  const [cards, setCards] = useState<CardDraft[]>([]);
  const [bills, setBills] = useState<BillDraft[]>([]);
  const keys = useRef(1);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, startSaving] = useTransition();

  // Rows keep their key while others are added and removed, so a bill stays on its card.
  const key = () => keys.current++;
  const presetName = (preset: BillPreset) => m.bills.presets[preset];

  /** The answers as saved: a step skipped is cleared before moving on, so whatever is here is what's wanted. */
  const answers = (): OnboardingAnswers => ({
    currency,
    salary: salaryOn ? salary : null,
    variableIncome,
    incomeEstimate: variableIncome ? incomeEstimate : "",
    cash,
    cards: cards.map(({ name, closingDay, paymentDays }) => ({ name, closingDay, paymentDays })),
    bills: bills.map((bill) => ({
      name: bill.preset ? presetName(bill.preset) : bill.name,
      amount: bill.amount,
      day: bill.day,
      card: bill.card === null ? null : cards.findIndex((card) => card.key === bill.card),
      variable: bill.preset !== null && VARIABLE_BILLS.includes(bill.preset),
    })),
    spendingEstimates: categories.map((category) => ({ categoryId: category.id, amount: spending[category.id] ?? "" })),
  });

  /** The step's own answers checked the way the server will, as the message to show, or null when they're fine. */
  const problem = (current: Step) => {
    const all = answers();
    const only: Partial<Record<Step, Partial<OnboardingAnswers>>> = {
      income: { salary: all.salary, variableIncome: all.variableIncome, incomeEstimate: all.incomeEstimate },
      cash: { cash: all.cash },
      cards: { cards: all.cards },
      bills: { cards: all.cards, bills: all.bills },
      spending: { spendingEstimates: all.spendingEstimates },
    };
    if (!only[current]) return null;
    const result = planOnboarding({ ...emptyAnswers(currency), ...only[current] });
    if (!("error" in result)) return null;
    return { salary: m.income.invalid, cash: m.cash.invalid, cards: m.cards.invalid, bills: m.bills.invalid, estimates: m.spending.invalid, currency: null }[result.error];
  };

  const index = STEPS.indexOf(step);
  const go = (to: Step) => {
    setInvalid(null);
    setStep(to);
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    const found = problem(step);
    if (found) return setInvalid(found);
    go(STEPS[index + 1]);
  };
  const skip = () => {
    if (step === "income") {
      setSalaryOn(false);
      setVariableIncome(false);
      setIncomeEstimate("");
    } else if (step === "cash") setCash("");
    else if (step === "cards") {
      setCards([]);
      setBills((current) => current.map((bill) => ({ ...bill, card: null })));
    } else if (step === "bills") setBills([]);
    else if (step === "spending") setSpending({});
    go(STEPS[index + 1]);
  };
  const finish = (toSave: OnboardingAnswers) => {
    setInvalid(null);
    if (!save) return setFinished(true);
    startSaving(async () => {
      const result = await save(toSave, locale);
      if (result?.error) setInvalid(m.error);
    });
  };

  if (finished) {
    return (
      <Frame preview>
        <div className="space-y-6 text-center">
          <h1 className="font-display text-2xl font-semibold">{m.previewDone}</h1>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground" href={`/${locale}/month`}>
            {m.backToApp}
          </Link>
        </div>
      </Frame>
    );
  }

  const field = (label: string, input: ReactNode, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {input}
      {hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
  const choice = (on: boolean, toggle: () => void, title: string, hint: string) => (
    <button
      aria-pressed={on}
      className={cn("flex w-full items-start gap-3 rounded-xl border p-4 text-left transition", on ? "border-primary bg-primary/10" : "border-border bg-surface")}
      onClick={toggle}
      type="button"
    >
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
        {on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
  const updateCard = (cardKey: number, change: Partial<CardDraft>) => setCards((current) => current.map((card) => (card.key === cardKey ? { ...card, ...change } : card)));
  const updateBill = (billKey: number, change: Partial<BillDraft>) => setBills((current) => current.map((bill) => (bill.key === billKey ? { ...bill, ...change } : bill)));
  const togglePreset = (preset: BillPreset) => {
    const added: BillDraft = { key: key(), preset, name: "", amount: "", day: "", card: null };
    setBills((current) => (current.some((bill) => bill.preset === preset) ? current.filter((bill) => bill.preset !== preset) : [...current, added]));
  };

  const spendingTotal = Object.values(spending).reduce((sum, amount) => sum + (parseAmountToCents(amount) ?? 0), 0);
  const summary = (() => {
    const all = answers();
    const cashCents = parseAmountToCents(all.cash) ?? (all.cash.trim() ? 0 : null);
    const lines = [
      all.salary ? format(m.done.salary, { name: all.salary.name }) : null,
      all.variableIncome ? m.done.variable : null,
      cashCents === null ? null : format(m.done.cash, { amount: formatCents(cashCents, currency) }),
      all.cards.length > 0 ? format(m.done.cards, { count: all.cards.length }) : null,
      all.bills.length > 0 ? format(m.done.bills, { count: all.bills.length }) : null,
      spendingTotal > 0 ? format(m.done.estimates, { amount: formatCents(spendingTotal, currency) }) : null,
    ].filter((line): line is string => line !== null);
    return lines;
  })();

  return (
    <Frame preview={!save} previewLabel={m.preview}>
      {step !== "welcome" ? <p className="text-xs font-medium text-muted-foreground">{format(m.step, { current: index, total: STEPS.length - 1 })}</p> : null}

      {step === "welcome" ? (
        <Screen body={m.welcome.body} title={m.welcome.title}>
          {field(m.welcome.language, (
            <div className="flex gap-2">
              {locales.map((option) => (
                <Link
                  aria-current={option === locale ? "page" : undefined}
                  className={cn("flex min-h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold", option === locale ? "border-primary bg-primary/10" : "border-border bg-surface text-muted-foreground")}
                  href={`/${option}/${basePath}`}
                  key={option}
                >
                  {new Intl.DisplayNames(option, { type: "language" }).of(option)}
                </Link>
              ))}
            </div>
          ))}
          {field(m.welcome.currency, (
            <select className={inputClass} onChange={(event) => setCurrency(event.target.value)} value={currency}>
              {CURRENCIES.map((option) => <option key={option} value={option}>{option} · {new Intl.DisplayNames(locale, { type: "currency" }).of(option)}</option>)}
            </select>
          ), m.welcome.currencyHint)}
        </Screen>
      ) : null}

      {step === "income" ? (
        <Screen body={m.income.body} title={m.income.title}>
          {choice(salaryOn, () => setSalaryOn((on) => !on), m.income.salary, m.income.salaryHint)}
          {salaryOn ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              {field(m.income.salaryName, <input className={inputClass} maxLength={40} onChange={(event) => setSalary({ ...salary, name: event.target.value })} value={salary.name} />)}
              {field(m.income.amount, <input className={inputClass} inputMode="decimal" onChange={(event) => setSalary({ ...salary, amount: event.target.value })} placeholder="0.00" value={salary.amount} />)}
              {field(m.income.schedule, (
                <select
                  className={inputClass}
                  onChange={(event) => {
                    const schedule = event.target.value as SalarySchedule;
                    setSalary({ ...salary, schedule, days: schedule === "MONTHLY" ? "30" : schedule === "TWICE_MONTHLY" ? "15, 30" : salary.days });
                  }}
                  value={salary.schedule}
                >
                  {SALARY_SCHEDULES.map((schedule) => <option key={schedule} value={schedule}>{m.income.schedules[schedule]}</option>)}
                </select>
              ))}
              {salary.schedule === "MONTHLY" || salary.schedule === "TWICE_MONTHLY"
                ? field(salary.schedule === "MONTHLY" ? m.income.day : m.income.days, (
                  <input className={inputClass} inputMode="numeric" onChange={(event) => setSalary({ ...salary, days: event.target.value })} value={salary.days} />
                ), salary.schedule === "TWICE_MONTHLY" ? m.income.daysHint : undefined)
                : field(m.income.anchor, <input className={inputClass} onChange={(event) => setSalary({ ...salary, anchor: event.target.value })} type="date" value={salary.anchor} />)}
            </div>
          ) : null}
          {choice(variableIncome, () => setVariableIncome((on) => !on), m.income.variable, m.income.variableHint)}
          {variableIncome ? (
            <div className="rounded-xl border border-border p-4">
              {field(m.income.estimate, (
                <input className={inputClass} inputMode="decimal" onChange={(event) => setIncomeEstimate(event.target.value)} placeholder="0.00" value={incomeEstimate} />
              ), m.income.estimateHint)}
            </div>
          ) : null}
        </Screen>
      ) : null}

      {step === "cash" ? (
        <Screen body={m.cash.body} title={m.cash.title}>
          {field(m.cash.amount, <input autoFocus className={inputClass} inputMode="decimal" onChange={(event) => setCash(event.target.value)} placeholder="0.00" value={cash} />)}
        </Screen>
      ) : null}

      {step === "cards" ? (
        <Screen body={m.cards.body} title={m.cards.title}>
          {cards.map((card) => (
            <div className="space-y-3 rounded-xl border border-border p-4" key={card.key}>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  {field(m.cards.name, <input className={inputClass} maxLength={40} onChange={(event) => updateCard(card.key, { name: event.target.value })} placeholder={m.cards.namePlaceholder} value={card.name} />)}
                </div>
                <RemoveButton label={m.cards.remove} onClick={() => {
                  setCards((current) => current.filter((other) => other.key !== card.key));
                  setBills((current) => current.map((bill) => (bill.card === card.key ? { ...bill, card: null } : bill)));
                }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field(m.cards.closingDay, <input className={inputClass} inputMode="numeric" onChange={(event) => updateCard(card.key, { closingDay: event.target.value })} value={card.closingDay} />)}
                {field(m.cards.paymentDays, <input className={inputClass} inputMode="numeric" onChange={(event) => updateCard(card.key, { paymentDays: event.target.value })} value={card.paymentDays} />)}
              </div>
            </div>
          ))}
          {cards.length < MAX_ONBOARDING_CARDS ? (
            <AddButton label={cards.length === 0 ? m.cards.add : m.cards.addAnother} onClick={() => {
              const added: CardDraft = { key: key(), name: "", closingDay: "", paymentDays: "20" };
              setCards((current) => [...current, added]);
            }} />
          ) : null}
        </Screen>
      ) : null}

      {step === "bills" ? (
        <Screen body={m.bills.body} title={m.bills.title}>
          <div className="flex flex-wrap gap-2">
            {BILL_PRESETS.map((preset) => {
              const on = bills.some((bill) => bill.preset === preset);
              return (
                <button
                  aria-pressed={on}
                  className={cn("flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition", on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground")}
                  key={preset}
                  onClick={() => togglePreset(preset)}
                  type="button"
                >
                  {on ? <Check aria-hidden="true" className="size-3.5 text-primary" strokeWidth={3} /> : null}
                  {presetName(preset)}
                </button>
              );
            })}
          </div>
          {bills.map((bill) => (
            <div className="space-y-3 rounded-xl border border-border p-4" key={bill.key}>
              <div className="flex items-center gap-2">
                {bill.preset ? <p className="flex-1 font-medium">{presetName(bill.preset)}</p> : (
                  <div className="flex-1">
                    {field(m.bills.otherName, <input className={inputClass} maxLength={40} onChange={(event) => updateBill(bill.key, { name: event.target.value })} value={bill.name} />)}
                  </div>
                )}
                <RemoveButton label={m.bills.remove} onClick={() => setBills((current) => current.filter((other) => other.key !== bill.key))} />
              </div>
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                {field(m.bills.amount, <input className={inputClass} inputMode="decimal" onChange={(event) => updateBill(bill.key, { amount: event.target.value })} placeholder="0.00" value={bill.amount} />)}
                {field(m.bills.day, <input className={inputClass} inputMode="numeric" onChange={(event) => updateBill(bill.key, { day: event.target.value })} value={bill.day} />)}
              </div>
              {bill.preset && VARIABLE_BILLS.includes(bill.preset) ? <p className="text-xs text-subtle">{m.bills.variableHint}</p> : null}
              {cards.length > 0 ? field(m.bills.paidWith, (
                <select className={inputClass} onChange={(event) => updateBill(bill.key, { card: event.target.value === "" ? null : Number(event.target.value) })} value={bill.card ?? ""}>
                  <option value="">{m.bills.cash}</option>
                  {cards.map((card) => <option key={card.key} value={card.key}>{card.name || "–"}</option>)}
                </select>
              )) : null}
            </div>
          ))}
          {bills.length < MAX_ONBOARDING_BILLS ? (
            <AddButton label={m.bills.other} onClick={() => {
              const added: BillDraft = { key: key(), preset: null, name: "", amount: "", day: "", card: null };
              setBills((current) => [...current, added]);
            }} />
          ) : null}
        </Screen>
      ) : null}

      {step === "spending" ? (
        <Screen body={m.spending.body} title={m.spending.title}>
          <div className="divide-y divide-border rounded-xl border border-border">
            {categories.map((category) => (
              <label className="flex items-center gap-3 px-4 py-2" key={category.id}>
                <span className="flex-1 font-medium">{category.label}</span>
                <input
                  aria-label={category.label}
                  className={cn(inputClass, "w-36 text-right")}
                  inputMode="decimal"
                  onChange={(event) => setSpending((current) => ({ ...current, [category.id]: event.target.value }))}
                  placeholder="0.00"
                  value={spending[category.id] ?? ""}
                />
              </label>
            ))}
          </div>
          {spendingTotal > 0 ? (
            <p className="flex justify-between px-1 text-sm"><span className="text-muted-foreground">{m.spending.total}</span><span className="font-semibold">{formatCents(spendingTotal, currency)}</span></p>
          ) : null}
          <p className="text-sm text-muted-foreground">{m.spending.hint}</p>
        </Screen>
      ) : null}

      {step === "done" ? (
        <Screen body={m.done.body} title={m.done.title}>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.done.summary}</p>
            {summary.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{m.done.nothing}</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {summary.map((line) => (
                  <li className="flex items-center gap-2" key={line}><Check aria-hidden="true" className="size-4 text-primary" />{line}</li>
                ))}
              </ul>
            )}
          </div>
        </Screen>
      ) : null}

      {invalid ? <p className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">{invalid}</p> : null}

      <div className="space-y-3 pt-2">
        {step === "done" ? (
          <button className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60" disabled={saving} onClick={() => finish(answers())} type="button">
            {saving ? m.saving : m.finish}
          </button>
        ) : (
          <button className="min-h-12 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground" onClick={next} type="button">{m.next}</button>
        )}
        <div className="flex items-center justify-between">
          {step !== "welcome" ? (
            <button className="min-h-11 px-2 text-sm font-medium text-muted-foreground" disabled={saving} onClick={() => go(STEPS[index - 1])} type="button">{m.back}</button>
          ) : <span />}
          {step === "welcome" ? (
            <button className="min-h-11 px-2 text-sm font-medium text-muted-foreground" disabled={saving} onClick={() => finish(emptyAnswers(currency))} type="button">{m.skipAll}</button>
          ) : step !== "done" ? (
            <button className="min-h-11 px-2 text-sm font-medium text-muted-foreground" onClick={skip} type="button">{m.skip}</button>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ preview, previewLabel, children }: { preview: boolean; previewLabel?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-4 pb-10 pt-6">
      <Image alt="Yield" height={29} priority src="/brand/yield-logo.svg" width={95} />
      {preview && previewLabel ? <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">{previewLabel}</p> : null}
      {children}
    </main>
  );
}

function Screen({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      {children}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-primary" onClick={onClick} type="button">
      <Plus aria-hidden="true" className="size-4" />{label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-loss" onClick={onClick} title={label} type="button">
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}
