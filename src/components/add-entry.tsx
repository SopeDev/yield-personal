"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income-form";
import { Card } from "./section";

type EntryType = "expense" | "income";

/**
 * Quick add with Expense and Income tabs. Switching tabs keeps the typed amount, and the URL follows the tab so
 * a reload opens the same one.
 */
export function AddEntry({ locale, messages, initialType, expense, income }: {
  locale: string;
  messages: Messages;
  initialType: EntryType;
  expense: Omit<ComponentProps<typeof ExpenseForm>, "amount" | "onAmountChange" | "locale" | "messages">;
  income: Omit<ComponentProps<typeof IncomeForm>, "amount" | "onAmountChange" | "locale" | "messages">;
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState("");

  function switchTo(next: EntryType) {
    setType(next);
    window.history.replaceState(null, "", `/${locale}/add${next === "income" ? "?type=income" : ""}`);
  }

  const tabs = [
    { type: "expense", label: messages.add.expense },
    { type: "income", label: messages.add.income },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={tab.type === type}
            className={cn("flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold transition", tab.type === type ? "bg-background text-foreground" : "text-muted-foreground")}
            key={tab.type}
            onClick={() => switchTo(tab.type)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {type === "expense" ? (
        <ExpenseForm {...expense} amount={amount} locale={locale} messages={messages} onAmountChange={setAmount} />
      ) : income.sources.length > 0 ? (
        <IncomeForm {...income} amount={amount} locale={locale} messages={messages} onAmountChange={setAmount} />
      ) : (
        <Card className="px-4 py-8 text-center">
          <p className="text-muted-foreground">{messages.add.noSources}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground" href={`/${locale}/settings`}>
            {messages.add.goToSettings}
          </Link>
        </Card>
      )}
    </div>
  );
}
