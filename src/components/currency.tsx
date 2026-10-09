"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CURRENCY, type Currency } from "@/lib/money";

const CurrencyContext = createContext<Currency>(DEFAULT_CURRENCY);

/** Makes the signed-in user's main currency available to every amount below it. */
export function CurrencyProvider({ currency, children }: { currency: Currency; children: ReactNode }) {
  return <CurrencyContext value={currency}>{children}</CurrencyContext>;
}

/** The main currency amounts are shown in. */
export function useCurrency() {
  return useContext(CurrencyContext);
}
