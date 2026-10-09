import { cleanItemName, normalizeItemName } from "./items";

/** The source choice that means "a new source, named in the form". */
export const NEW_SOURCE = "new";

/** Longest income source name. */
export const MAX_SOURCE_NAME_LENGTH = 40;

/** A typed source name as stored: trimmed, with repeated spaces collapsed and its casing kept. */
export const cleanSourceName = cleanItemName;

/**
 * The source a typed name refers to, ignoring case and repeated spaces. Settings may hold two sources with the same
 * name, so an active one wins over an archived one, and then the earliest listed.
 */
export function findSourceByName<T extends { name: string; archivedAt?: Date | null }>(sources: T[], name: string) {
  const normalized = normalizeItemName(name);
  if (!normalized) return undefined;
  const matches = sources.filter((source) => normalizeItemName(source.name) === normalized);
  return matches.find((source) => !source.archivedAt) ?? matches[0];
}
