export const BUILT_IN_CATEGORY_KEYS = ["fixed", "food", "car", "extras"] as const;

export type BuiltInCategoryKey = (typeof BUILT_IN_CATEGORY_KEYS)[number];

export const CATEGORY_KINDS = ["EVERYDAY", "BILLS", "OCCASIONAL"] as const;

/**
 * How a category's spending counts: everyday spending (daily net, typical daily spending, and averages), bills
 * (averages only; they mostly arrive as recurring payments), or occasional (neither, like one-off extras).
 */
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** The type each built-in category starts with. */
export const BUILT_IN_CATEGORY_KINDS: Record<BuiltInCategoryKey, CategoryKind> = { fixed: "BILLS", food: "EVERYDAY", car: "EVERYDAY", extras: "OCCASIONAL" };

export function isCategoryKind(value: string): value is CategoryKind {
  return (CATEGORY_KINDS as readonly string[]).includes(value);
}

/** Spending that describes a typical month, for average monthly spending. */
export function countsInAverage(category: { kind: CategoryKind }) {
  return category.kind !== "OCCASIONAL";
}

/** Day-to-day spending, for daily net and typical daily spending. */
export function isEveryday(category: { kind: CategoryKind }) {
  return category.kind === "EVERYDAY";
}

type CategoryLabelSource = { key: string | null; name: string | null };

/** A custom name wins; built-in categories otherwise use their translated label. */
export function categoryLabel(category: CategoryLabelSource, labels: Record<BuiltInCategoryKey, string>) {
  if (category.name) return category.name;
  if (category.key && category.key in labels) return labels[category.key as BuiltInCategoryKey];
  return "";
}
