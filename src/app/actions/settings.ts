"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { LOCALE_COOKIE } from "@/i18n/config";
import { isCategoryKind, type CategoryKind } from "@/lib/categories";
import { loadCashOnHand } from "@/lib/ledger-data";
import { isCurrency, parseAmountToCents } from "@/lib/money";
import { isIncomeRhythmKind, parsePayDays } from "@/lib/income-rhythm";
import { dateFromKey, isDateKey, isMonthKey } from "@/lib/months";
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

/** The source's income group: none, or one of the user's active groups. */
async function readSourceGroup(userId: string, formData: FormData) {
  const groupId = readText(formData, "groupId");
  if (!groupId) return { groupId: null };
  if (!z.uuid().safeParse(groupId).success) return null;
  const group = await db.incomeGroup.findFirst({ where: { id: groupId, userId, archivedAt: null }, select: { id: true } });
  return group ? { groupId: group.id } : null;
}

export async function createIncomeSource(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };
  const group = await readSourceGroup(userId, formData);
  if (!group) return { fieldErrors: { groupId: "generic" } };

  await db.incomeSource.create({ data: { userId, name, groupId: group.groupId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

export async function updateIncomeSource(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!z.uuid().safeParse(id).success) return { error: "generic" };
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };
  // A source may keep a group archived since; it just can't move into one.
  const current = await db.incomeSource.findFirst({ where: { id, userId }, select: { groupId: true } });
  if (!current) return { error: "generic" };
  const group = readText(formData, "groupId") === current.groupId ? { groupId: current.groupId } : await readSourceGroup(userId, formData);
  if (!group) return { fieldErrors: { groupId: "generic" } };

  await db.incomeSource.update({ where: { id }, data: { name, groupId: group.groupId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** The categories an income group deducts, limited to the user's own. */
async function readDeductions(userId: string, formData: FormData) {
  const ids = formData.getAll("deductCategoryId").map(String).filter((id) => z.uuid().safeParse(id).success);
  if (ids.length === 0) return [];
  const categories = await db.category.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  return categories.map((category) => category.id);
}

export async function createIncomeGroup(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };
  const categoryIds = await readDeductions(userId, formData);

  await db.incomeGroup.create({ data: { userId, name, deductions: { create: categoryIds.map((categoryId) => ({ categoryId })) } } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Changing what a group deducts applies to every month, past ones included, like a card's billing cycle. */
export async function updateIncomeGroup(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  if (!z.uuid().safeParse(id).success) return { error: "generic" };
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };
  const group = await db.incomeGroup.findFirst({ where: { id, userId }, select: { id: true } });
  if (!group) return { error: "generic" };
  const categoryIds = await readDeductions(userId, formData);

  await db.$transaction([
    db.incomeGroup.update({ where: { id }, data: { name } }),
    db.incomeGroupDeduction.deleteMany({ where: { groupId: id } }),
    db.incomeGroupDeduction.createMany({ data: categoryIds.map((categoryId) => ({ groupId: id, categoryId })) }),
  ]);
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Archived groups keep netting the sources still in them, but new sources can't join. */
export async function archiveIncomeGroup(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.incomeGroup.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function archiveIncomeSource(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.incomeSource.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

function readKind(formData: FormData): CategoryKind {
  const kind = readText(formData, "kind");
  return isCategoryKind(kind) ? kind : "EVERYDAY";
}

export async function createCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  if (!name || name.length > MAX_NAME_LENGTH) return { fieldErrors: { name: "name" } };

  const last = await db.category.findFirst({ where: { userId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.category.create({
    data: { userId, name, kind: readKind(formData), sortOrder: (last?.sortOrder ?? -1) + 1 },
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

  await db.category.update({ where: { id }, data: { name: name || null, kind: readKind(formData) } });
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

export type CashOnHandState = FormState & { offByCents?: number | null };

/** Sets money on hand to what the user counted, returning how far it was from the tracked amount (null the first time). */
export async function setCashOnHand(_state: CashOnHandState, formData: FormData): Promise<CashOnHandState> {
  const userId = await requireActionUserId();
  const cents = parseAmountToCents(readText(formData, "amount"));
  if (cents === null) return { fieldErrors: { amount: "amount" } };
  const trackedCents = await loadCashOnHand(userId);
  await db.user.update({ where: { id: userId }, data: { cashOnHandCents: cents, cashOnHandSetAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now(), offByCents: trackedCents === null ? null : cents - trackedCents };
}

/** Sets when income arrives: daily, weekly or every two weeks from a payday, or on days of the month. */
export async function setIncomeRhythm(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const kind = readText(formData, "kind");
  if (!isIncomeRhythmKind(kind)) return { error: "generic" };

  const data = { incomeRhythm: kind, incomeRhythmAnchor: null as Date | null, incomePayDays: [] as number[] };
  if (kind === "WEEKLY" || kind === "BIWEEKLY") {
    const anchor = readText(formData, "anchor");
    if (!isDateKey(anchor)) return { fieldErrors: { anchor: "date" } };
    data.incomeRhythmAnchor = dateFromKey(anchor);
  } else if (kind === "MONTH_DAYS") {
    const days = parsePayDays(readText(formData, "days"));
    if (!days) return { fieldErrors: { days: "payDays" } };
    data.incomePayDays = days;
  }

  await db.user.update({ where: { id: userId }, data });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

/** Sets the first month counted in calculations from past spending; earlier months may hold only partial records. */
export async function setHistoryStart(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const month = readText(formData, "month");
  if (!isMonthKey(month)) return { fieldErrors: { month: "month" } };
  await db.user.update({ where: { id: userId }, data: { historyStartMonth: dateFromKey(`${month}-01`) } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

export async function clearHistoryStart(formData: FormData) {
  const userId = await requireActionUserId();
  await db.user.update({ where: { id: userId }, data: { historyStartMonth: null } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/** Sets the main currency. Amounts are relabeled, not converted. */
export async function setCurrency(formData: FormData) {
  const userId = await requireActionUserId();
  const currency = readText(formData, "currency");
  if (!isCurrency(currency)) return;
  await db.user.update({ where: { id: userId }, data: { currency } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
