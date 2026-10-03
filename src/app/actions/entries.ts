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

export async function createPurchase(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);

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
  if (!z.uuid().safeParse(categoryId).success) fieldErrors.categoryId = "category";
  if (!z.uuid().safeParse(paymentMethodId).success) fieldErrors.paymentMethodId = "paymentMethod";
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > MAX_INSTALLMENTS) {
    fieldErrors.installments = "installments";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const [category, paymentMethod] = await Promise.all([
    db.category.findFirst({ where: { id: categoryId, userId }, select: { id: true } }),
    db.paymentMethod.findFirst({ where: { id: paymentMethodId, userId, archivedAt: null }, select: { kind: true } }),
  ]);
  if (!category) return { fieldErrors: { categoryId: "category" } };
  if (!paymentMethod) return { fieldErrors: { paymentMethodId: "paymentMethod" } };
  if (installmentCount > 1 && paymentMethod.kind !== "CARD") return { fieldErrors: { installments: "installments" } };

  await db.purchase.create({
    data: { userId, categoryId, paymentMethodId, date: dateFromKey(date), amountCents: amountCents!, description, installmentCount },
  });

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/month?m=${date.slice(0, 7)}`);
}

export async function createIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);

  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const date = readText(formData, "date");
  const sourceId = readText(formData, "sourceId");
  const note = readText(formData, "note");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (!isDateKey(date)) fieldErrors.date = "date";
  if (!z.uuid().safeParse(sourceId).success) fieldErrors.sourceId = "source";
  if (note.length > MAX_NOTE_LENGTH) fieldErrors.note = "generic";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const source = await db.incomeSource.findFirst({ where: { id: sourceId, userId, archivedAt: null }, select: { id: true } });
  if (!source) return { fieldErrors: { sourceId: "source" } };

  await db.income.create({ data: { userId, sourceId, date: dateFromKey(date), amountCents: amountCents!, note: note || null } });

  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/income?m=${date.slice(0, 7)}`);
}

export async function deletePurchase(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.purchase.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function deleteIncome(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.income.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
