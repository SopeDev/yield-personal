import "server-only";

import { z } from "zod";
import { db } from "@/db/client";
import { cleanSourceName, findSourceByName, MAX_SOURCE_NAME_LENGTH, NEW_SOURCE } from "@/lib/income-sources";

export type SourceResolution = { sourceId: string } | { error: "source" | "name" | "group" };

/**
 * Finds the income source for a form submission: a chosen `sourceId` (an archived one only when `allowArchived`, so
 * an edited entry can keep its own), or, when the choice is a new source, a typed name matching an existing source
 * (an archived one comes back, keeping its group), else a new source in `groupId` (no group when empty).
 */
export async function resolveIncomeSource(userId: string, { sourceId, sourceName, groupId, allowArchived }: {
  sourceId: string;
  sourceName: string;
  groupId: string;
  allowArchived: boolean;
}): Promise<SourceResolution> {
  if (sourceId !== NEW_SOURCE) {
    if (!z.uuid().safeParse(sourceId).success) return { error: "source" };
    const source = await db.incomeSource.findFirst({ where: { id: sourceId, userId, ...(allowArchived ? {} : { archivedAt: null }) }, select: { id: true } });
    return source ? { sourceId: source.id } : { error: "source" };
  }

  const name = cleanSourceName(sourceName);
  if (!name || name.length > MAX_SOURCE_NAME_LENGTH) return { error: "name" };
  const sources = await db.incomeSource.findMany({ where: { userId }, select: { id: true, name: true, archivedAt: true }, orderBy: { createdAt: "asc" } });
  const existing = findSourceByName(sources, name);
  if (existing) {
    if (existing.archivedAt) await db.incomeSource.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return { sourceId: existing.id };
  }

  let group: { id: string } | null = null;
  if (groupId) {
    if (!z.uuid().safeParse(groupId).success) return { error: "group" };
    group = await db.incomeGroup.findFirst({ where: { id: groupId, userId, archivedAt: null }, select: { id: true } });
    if (!group) return { error: "group" };
  }
  const source = await db.incomeSource.create({ data: { userId, name, groupId: group?.id ?? null }, select: { id: true } });
  return { sourceId: source.id };
}
