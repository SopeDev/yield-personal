import "server-only";

import { z } from "zod";
import { db } from "@/db/client";
import { cleanItemName, normalizeItemName } from "@/lib/items";

export const MAX_ITEM_NAME_LENGTH = 60;

type ItemInput = { itemId: string; itemName: string; categoryId: string };
export type ItemResolution = { itemId: string } | { error: "item" | "category" };

/**
 * Finds the expense item for a form submission: an explicit `itemId`, or a typed name that matches an existing
 * item (whose own category then applies), or a new item created in `categoryId`. Typing the name of an archived
 * item brings it back.
 */
export async function resolveItem(userId: string, { itemId, itemName, categoryId }: ItemInput): Promise<ItemResolution> {
  if (z.uuid().safeParse(itemId).success) {
    const item = await db.expenseItem.findFirst({ where: { id: itemId, userId }, select: { id: true } });
    return item ? { itemId: item.id } : { error: "item" };
  }

  const name = cleanItemName(itemName);
  if (!name || name.length > MAX_ITEM_NAME_LENGTH) return { error: "item" };
  const normalizedName = normalizeItemName(name);

  const existing = await db.expenseItem.findUnique({
    where: { userId_normalizedName: { userId, normalizedName } },
    select: { id: true, archivedAt: true },
  });
  if (existing) {
    if (existing.archivedAt) await db.expenseItem.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return { itemId: existing.id };
  }

  if (!z.uuid().safeParse(categoryId).success) return { error: "category" };
  const category = await db.category.findFirst({ where: { id: categoryId, userId, archivedAt: null }, select: { id: true } });
  if (!category) return { error: "category" };

  // Upsert so two simultaneous submissions of a new name still end up with one item.
  const item = await db.expenseItem.upsert({
    where: { userId_normalizedName: { userId, normalizedName } },
    create: { userId, categoryId, name, normalizedName },
    update: {},
    select: { id: true },
  });
  return { itemId: item.id };
}
