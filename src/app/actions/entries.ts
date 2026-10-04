"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { MAX_INSTALLMENTS } from "@/lib/installments";
import { parseAmountToCents } from "@/lib/money";
import { dateFromKey, isDateKey } from "@/lib/months";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

const MAX_DESCRIPTION_LENGTH = 120;
const MAX_NOTE_LENGTH = 200;

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

/**
 * An optional client-generated id makes creating an entry idempotent, so a retried submission (for example
 * from an offline queue) never records the same purchase twice.
 */
function readClientId(formData: FormData) {
  const id = readText(formData, "clientId");
  return isUuid(id) ? id : undefined;
}

async function parsePurchase(userId: string, formData: FormData, { isEdit }: { isEdit: boolean }) {
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const description = readText(formData, "description");
  const date = readText(formData, "date");
  const categoryId = readText(formData, "categoryId");
  const paymentMethodId = readText(formData, "paymentMethodId");
  const installmentCount = Number(readText(formData, "installments") || "1");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) fieldErrors.description = "description";
  if (!isDateKey(date)) fieldErrors.date = "date";
  if (!isUuid(categoryId)) fieldErrors.categoryId = "category";
  if (!isUuid(paymentMethodId)) fieldErrors.paymentMethodId = "paymentMethod";
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > MAX_INSTALLMENTS) fieldErrors.installments = "installments";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // New entries need an active category and payment method; edits may keep archived ones they already use.
  const activeOnly = isEdit ? {} : { archivedAt: null };
  const [category, paymentMethod] = await Promise.all([
    db.category.findFirst({ where: { id: categoryId, userId, ...activeOnly }, select: { id: true } }),
    db.paymentMethod.findFirst({ where: { id: paymentMethodId, userId, ...activeOnly }, select: { kind: true } }),
  ]);
  if (!category) return { fieldErrors: { categoryId: "category" } as FormState["fieldErrors"] };
  if (!paymentMethod) return { fieldErrors: { paymentMethodId: "paymentMethod" } as FormState["fieldErrors"] };
  if (installmentCount > 1 && paymentMethod.kind !== "CARD") return { fieldErrors: { installments: "installments" } as FormState["fieldErrors"] };

  return { data: { categoryId, paymentMethodId, date: dateFromKey(date), amountCents: amountCents!, description, installmentCount }, month: date.slice(0, 7) };
}

async function parseIncome(userId: string, formData: FormData, { isEdit }: { isEdit: boolean }) {
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const date = readText(formData, "date");
  const sourceId = readText(formData, "sourceId");
  const note = readText(formData, "note");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (!isDateKey(date)) fieldErrors.date = "date";
  if (!isUuid(sourceId)) fieldErrors.sourceId = "source";
  if (note.length > MAX_NOTE_LENGTH) fieldErrors.note = "generic";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const source = await db.incomeSource.findFirst({ where: { id: sourceId, userId, ...(isEdit ? {} : { archivedAt: null }) }, select: { id: true } });
  if (!source) return { fieldErrors: { sourceId: "source" } as FormState["fieldErrors"] };

  return { data: { sourceId, date: dateFromKey(date), amountCents: amountCents!, note: note || null }, month: date.slice(0, 7) };
}

export async function createPurchase(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const parsed = await parsePurchase(userId, formData, { isEdit: false });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const id = readClientId(formData);
  const existing = id ? await db.purchase.findUnique({ where: { id }, select: { userId: true } }) : null;
  if (existing && existing.userId !== userId) return { error: "generic" };
  if (!existing) await db.purchase.create({ data: { id, userId, ...parsed.data } });

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/month?m=${parsed.month}`);
}

export async function updatePurchase(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const parsed = await parsePurchase(userId, formData, { isEdit: true });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const { count } = await db.purchase.updateMany({ where: { id, userId }, data: parsed.data });
  if (count === 0) return { error: "generic" };

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/month?m=${parsed.month}`);
}

export async function createIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const parsed = await parseIncome(userId, formData, { isEdit: false });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const id = readClientId(formData);
  const existing = id ? await db.income.findUnique({ where: { id }, select: { userId: true } }) : null;
  if (existing && existing.userId !== userId) return { error: "generic" };
  if (!existing) await db.income.create({ data: { id, userId, ...parsed.data } });

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/income?m=${parsed.month}`);
}

export async function updateIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const parsed = await parseIncome(userId, formData, { isEdit: true });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const { count } = await db.income.updateMany({ where: { id, userId }, data: parsed.data });
  if (count === 0) return { error: "generic" };

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/income?m=${parsed.month}`);
}

export async function deletePurchase(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.purchase.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function deleteIncome(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.income.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
