"use client";

import { useState, type ComponentProps } from "react";
import type { Messages } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { ExchangeForm } from "./exchange-form";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income-form";

export type EntryType = "expense" | "income" | "exchange";

/**
 * Quick add with Expense and Income tabs, plus Exchange once there are cash wallets in several currencies.
 * Switching between Expense and Income keeps the typed amount, and the URL follows the tab so a reload opens the
 * same one.
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
    window.history.replaceState(null, "", `/${locale}/add${next === "expense" ? "" : `?type=${next}`}`);
  }

  const canExchange = income.currencies.length > 1;
  const tabs = [
    { type: "expense", label: messages.add.expense },
    { type: "income", label: messages.add.income },
    ...(canExchange ? [{ type: "exchange", label: messages.add.exchange }] as const : []),
  ] as const;

  return (
    <div className="space-y-6">
      <div className={cn("grid gap-1 rounded-xl border border-border bg-surface p-1", canExchange ? "grid-cols-3" : "grid-cols-2")} role="tablist">
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
      ) : type === "exchange" && canExchange ? (
        <ExchangeForm currencies={income.currencies} locale={locale} messages={messages} today={income.today} />
      ) : (
        <IncomeForm {...income} amount={amount} locale={locale} messages={messages} onAmountChange={setAmount} />
      )}
    </div>
  );
}
