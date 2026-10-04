/**
 * The key that makes two item names the same item: trimmed, whitespace collapsed, lowercase.
 * Must match the backfill in prisma/migrations/20261006000000_expense_items.
 */
export function normalizeItemName(name: string) {
  return cleanItemName(name).toLowerCase();
}

/** The display form of a typed item name: trimmed with whitespace collapsed, original casing kept. */
export function cleanItemName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}
