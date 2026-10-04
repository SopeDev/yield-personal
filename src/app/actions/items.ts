"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { MAX_ITEM_NAME_LENGTH } from "@/lib/item-resolution";
import { cleanItemName, normalizeItemName } from "@/lib/items";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

/** Renames an item or moves it (with all its history) to another category. */
export async function updateItem(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const name = cleanItemName(readText(formData, "name"));
  const categoryId = readText(formData, "categoryId");
  if (!isUuid(id)) return { error: "generic" };

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name || name.length > MAX_ITEM_NAME_LENGTH) fieldErrors.name = "item";
  if (!isUuid(categoryId)) fieldErrors.categoryId = "category";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const [item, category, sameName] = await Promise.all([
    db.expenseItem.findFirst({ where: { id, userId }, select: { id: true } }),
    db.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } }),
    db.expenseItem.findFirst({ where: { userId, normalizedName: normalizeItemName(name), id: { not: id } }, select: { id: true } }),
  ]);
  if (!item) return { error: "generic" };
  if (!category) return { fieldErrors: { categoryId: "category" } };
  // Two items can't share a name; combining them is an explicit merge.
  if (sameName) return { fieldErrors: { name: "itemExists" } };

  await db.expenseItem.update({ where: { id }, data: { name, normalizedName: normalizeItemName(name), categoryId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Archived items leave the suggestions but keep their history; typing the name again restores them. */
export async function archiveItem(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.expenseItem.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/** Moves every purchase and recurring payment of one item into another, then removes the first. */
export async function mergeItems(formData: FormData) {
  const userId = await requireActionUserId();
  const sourceId = readText(formData, "sourceId");
  const targetId = readText(formData, "targetId");
  if (!isUuid(sourceId) || !isUuid(targetId) || sourceId === targetId) return;

  const owned = await db.expenseItem.count({ where: { userId, id: { in: [sourceId, targetId] } } });
  if (owned !== 2) return;

  await db.$transaction([
    db.purchase.updateMany({ where: { userId, itemId: sourceId }, data: { itemId: targetId } }),
    db.recurringPayment.updateMany({ where: { userId, itemId: sourceId }, data: { itemId: targetId } }),
    db.expenseItem.delete({ where: { id: sourceId } }),
  ]);
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function restoreItem(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.expenseItem.updateMany({ where: { id, userId }, data: { archivedAt: null } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
