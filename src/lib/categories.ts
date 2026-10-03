export const BUILT_IN_CATEGORY_KEYS = ["fixed", "food", "car", "extras"] as const;

export type BuiltInCategoryKey = (typeof BUILT_IN_CATEGORY_KEYS)[number];

/** Spending in this category is subtracted from rideshare income to get net rideshare income. */
export const CAR_CATEGORY_KEY: BuiltInCategoryKey = "car";

type CategoryLabelSource = { key: string | null; name: string | null };

export function categoryLabel(category: CategoryLabelSource, labels: Record<BuiltInCategoryKey, string>) {
  if (category.key && category.key in labels) return labels[category.key as BuiltInCategoryKey];
  return category.name ?? "";
}
