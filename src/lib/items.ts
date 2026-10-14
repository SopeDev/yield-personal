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

/** Alphabetical order by name. Names are encrypted at rest, so lists are sorted here rather than by the database. */
export function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}
