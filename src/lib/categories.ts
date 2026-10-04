export const BUILT_IN_CATEGORY_KEYS = ["fixed", "food", "car", "extras"] as const;

export type BuiltInCategoryKey = (typeof BUILT_IN_CATEGORY_KEYS)[number];

/** One-off purchases don't describe typical monthly spending. */
export const EXCLUDED_FROM_AVERAGE_KEYS: readonly BuiltInCategoryKey[] = ["extras"];

/** Spending in this category is subtracted from rideshare income to get net rideshare income. */
export const CAR_CATEGORY_KEY: BuiltInCategoryKey = "car";

type CategoryLabelSource = { key: string | null; name: string | null };

/** A custom name wins; built-in categories otherwise use their translated label. */
export function categoryLabel(category: CategoryLabelSource, labels: Record<BuiltInCategoryKey, string>) {
  if (category.name) return category.name;
  if (category.key && category.key in labels) return labels[category.key as BuiltInCategoryKey];
  return "";
}
