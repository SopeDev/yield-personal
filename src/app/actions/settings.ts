"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { LOCALE_COOKIE } from "@/i18n/config";
import { parseAmountToCents } from "@/lib/money";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { MAX_PAYMENT_DAYS } from "@/lib/statements";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

const MAX_NAME_LENGTH = 40;
const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function readDay(formData: FormData, name: string) {
  const day = Number(readText(formData, name));
  return Number.isInteger(day) && day >= 1 && day <= MAX_STATEMENT_DAY ? day : null;
}

function parseCard(formData: FormData) {
  const name = readText(formData, "name");
  const color = readText(formData, "color");
  const closingDay = readDay(formData, "closingDay");
  const paymentDays = Number(readText(formData, "paymentDays"));

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name || name.length > MAX_NAME_LENGTH) fieldErrors.name = "name";
  if (!(CARD_COLORS as readonly string[]).includes(color)) fieldErrors.color = "color";
  if (!closingDay) fieldErrors.closingDay = "day";
  if (!Number.isInteger(paymentDays) || paymentDays < 1 || paymentDays > MAX_PAYMENT_DAYS) fieldErrors.paymentDays = "paymentDays";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { data: { name, color, closingDay: closingDay!, paymentDays } };
}

export async function createCard(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const parsed = parseCard(formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  await db.paymentMethod.create({ data: { userId, kind: "CARD", ...parsed.data } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Billing-cycle changes apply to every statement of the card, past ones included. */
export async function updateCard(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return { error: "generic" };
  const parsed = parseCard(formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const { count } = await db.paymentMethod.updateMany({ where: { id, userId, kind: "CARD" }, data: parsed.data });
  if (count === 0) return { error: "generic" };
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

export async function archiveCard(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.paymentMethod.updateMany({ where: { id, userId, kind: "CARD" }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function createIncomeSource(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };

  await db.incomeSource.create({ data: { userId, name, isRideshare: formData.get("isRideshare") === "on" } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

export async function updateIncomeSource(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!z.uuid().safeParse(id).success) return { error: "generic" };
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };

  const { count } = await db.incomeSource.updateMany({ where: { id, userId }, data: { name, isRideshare: formData.get("isRideshare") === "on" } });
  if (count === 0) return { error: "generic" };
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

export async function archiveIncomeSource(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.incomeSource.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function createCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };

  const last = await db.category.findFirst({ where: { userId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.category.create({
    data: { userId, name, includeInAverage: formData.get("includeInAverage") === "on", sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Renaming a built-in category stores a custom name, which takes precedence over the translated label. */
export async function updateCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!z.uuid().safeParse(id).success) return { error: "generic" };
  if (name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };

  const category = await db.category.findFirst({ where: { id, userId }, select: { key: true } });
  if (!category) return { error: "generic" };
  if (!name && !category.key) return { fieldErrors: { name: "name" } };

  await db.category.update({ where: { id }, data: { name: name || null, includeInAverage: formData.get("includeInAverage") === "on" } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Archived categories disappear from pickers but keep totalling the entries already in them. */
export async function archiveCategory(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  const remaining = await db.category.count({ where: { userId, archivedAt: null, id: { not: id } } });
  if (remaining === 0) return;
  await db.category.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function restoreCategory(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.category.updateMany({ where: { id, userId }, data: { archivedAt: null } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/** Swaps a category with its neighbor in the display order. */
export async function moveCategory(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const direction = readText(formData, "direction");
  if (!z.uuid().safeParse(id).success || (direction !== "up" && direction !== "down")) return;

  const categories = await db.category.findMany({ where: { userId, archivedAt: null }, select: { id: true, sortOrder: true }, orderBy: { sortOrder: "asc" } });
  const index = categories.findIndex((category) => category.id === id);
  const neighbor = categories[direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !neighbor) return;

  // Renumber everything so equal sort orders can't make the swap a no-op.
  const reordered = [...categories];
  [reordered[index], reordered[categories.indexOf(neighbor)]] = [neighbor, categories[index]];
  await db.$transaction(reordered.map((category, sortOrder) => db.category.update({ where: { id: category.id }, data: { sortOrder } })));
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function setLocale(formData: FormData) {
  const locale = localeFromForm(formData);
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS, sameSite: "lax", path: "/" });
  redirect(`/${locale}/settings`);
}

/** Sets the monthly balance goal: money to have left over or saved each month. */
export async function setBalanceGoal(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const goalCents = parseAmountToCents(readText(formData, "goal"));
  if (!goalCents) return { fieldErrors: { goal: "amount" } };
  await db.user.update({ where: { id: userId }, data: { balanceGoalCents: goalCents } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

export async function clearBalanceGoal(formData: FormData) {
  const userId = await requireActionUserId();
  await db.user.update({ where: { id: userId }, data: { balanceGoalCents: null } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
