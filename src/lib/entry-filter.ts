/** Lowercase without accents, so "gasolina" finds "Gasolína" and "cafe" finds "Café". */
export function searchText(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" ").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** An entry as the month filter sees it: what it can be found by, and what it adds to the filtered totals. */
export type FilterableEntry = {
  kind: "purchase" | "income" | "exchange";
  /** `searchText` of its item or source, category, payment method, and note. */
  text: string;
  /** Purchases only; incomes and exchanges belong to no category. */
  categoryId: string | null;
  cents: number;
  currency: string;
};

export type EntryFilter = { query: string; categoryId: string | null };

/** Whether an entry passes the filter: every word of the query appears in it, and it's in the chosen category. */
export function entryMatches(entry: Pick<FilterableEntry, "text" | "categoryId">, { query, categoryId }: EntryFilter) {
  if (categoryId !== null && entry.categoryId !== categoryId) return false;
  return searchText(query).split(/\s+/).filter(Boolean).every((word) => entry.text.includes(word));
}

/**
 * What the filtered entries add up to in the main currency: how many there are, spent (purchases) and received
 * (income). Entries in other currencies are counted but never added in, since currencies aren't converted.
 */
export function filteredTotals(entries: FilterableEntry[], mainCurrency: string) {
  const main = entries.filter((entry) => entry.currency === mainCurrency);
  const sum = (kind: FilterableEntry["kind"]) => main.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.cents, 0);
  return { count: entries.length, spentCents: sum("purchase"), receivedCents: sum("income") };
}
