"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { parseAmountToCents } from "@/lib/money";
import { addMonths, dateFromKey, isMonthKey, monthKeyOf } from "@/lib/months";
import { MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { currentMonthKey } from "@/lib/today";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

const MAX_NAME_LENGTH = 60;

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

async function parseRecurring(userId: string, formData: FormData) {
  const name = readText(formData, "name");
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const categoryId = readText(formData, "categoryId");
  const paymentMethodId = readText(formData, "paymentMethodId");
  const dayOfMonth = Number(readText(formData, "dayOfMonth"));

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name || name.length > MAX_NAME_LENGTH) fieldErrors.name = "name";
  if (!amountCents) fieldErrors.amount = "amount";
  if (!isUuid(categoryId)) fieldErrors.categoryId = "category";
  if (!isUuid(paymentMethodId)) fieldErrors.paymentMethodId = "paymentMethod";
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > MAX_STATEMENT_DAY) fieldErrors.dayOfMonth = "day";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const [category, paymentMethod] = await Promise.all([
    db.category.findFirst({ where: { id: categoryId, userId, archivedAt: null }, select: { id: true } }),
    db.paymentMethod.findFirst({ where: { id: paymentMethodId, userId, archivedAt: null }, select: { id: true } }),
  ]);
  if (!category) return { fieldErrors: { categoryId: "category" } as FormState["fieldErrors"] };
  if (!paymentMethod) return { fieldErrors: { paymentMethodId: "paymentMethod" } as FormState["fieldErrors"] };

  return { data: { name, amountCents: amountCents!, categoryId, paymentMethodId, dayOfMonth } };
}

export async function createRecurringPayment(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const startMonth = readText(formData, "startMonth");
  const parsed = await parseRecurring(userId, formData);
  const fieldErrors = { ...parsed.fieldErrors, ...(isMonthKey(startMonth) ? {} : { startMonth: "month" as const }) };
  if (!parsed.data || Object.keys(fieldErrors).length > 0) return { fieldErrors };

  await db.recurringPayment.create({ data: { userId, ...parsed.data, startMonth: dateFromKey(`${startMonth}-01`) } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/**
 * Edits apply from the current month on. A payment that already ran in earlier months is split: the old
 * version ends last month and a new version starts this month, so past months keep what was actually due.
 */
export async function updateRecurringPayment(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const recurring = await db.recurringPayment.findFirst({ where: { id, userId }, select: { startMonth: true, endMonth: true } });
  if (!recurring) return { error: "generic" };

  const month = currentMonthKey();
  if (recurring.endMonth && monthKeyOf(recurring.endMonth) < month) return { error: "recurringEnded" };
  const parsed = await parseRecurring(userId, formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  if (monthKeyOf(recurring.startMonth) >= month) {
    await db.recurringPayment.update({ where: { id }, data: parsed.data });
  } else {
    const thisMonth = dateFromKey(`${month}-01`);
    await db.$transaction(async (tx) => {
      await tx.recurringPayment.update({ where: { id }, data: { endMonth: dateFromKey(`${addMonths(month, -1)}-01`) } });
      const next = await tx.recurringPayment.create({
        data: { userId, ...parsed.data, startMonth: thisMonth, endMonth: recurring.endMonth },
        select: { id: true },
      });
      await tx.recurringOccurrence.updateMany({ where: { recurringPaymentId: id, month: { gte: thisMonth } }, data: { recurringPaymentId: next.id } });
    });
  }

  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}


/**
 * Stops a recurring payment. It stays in months already paid or changed, including this one;
 * a payment that never applied to any past month is removed entirely.
 */
export async function stopRecurringPayment(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;

  const recurring = await db.recurringPayment.findFirst({ where: { id, userId }, select: { startMonth: true } });
  if (!recurring) return;

  const month = currentMonthKey();
  const currentMonthTouched = await db.recurringOccurrence.findFirst({
    where: { recurringPaymentId: id, month: dateFromKey(`${month}-01`) },
    select: { id: true },
  });
  const lastMonth = currentMonthTouched ? month : addMonths(month, -1);

  if (lastMonth < monthKeyOf(recurring.startMonth)) {
    await db.recurringPayment.delete({ where: { id } });
  } else {
    await db.recurringPayment.update({ where: { id }, data: { endMonth: dateFromKey(`${lastMonth}-01`) } });
  }
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

async function findOwnedRecurring(userId: string, formData: FormData) {
  const id = readText(formData, "recurringPaymentId");
  const month = readText(formData, "month");
  if (!isUuid(id) || !isMonthKey(month)) return null;
  const recurring = await db.recurringPayment.findFirst({ where: { id, userId }, select: { id: true, amountCents: true, paymentMethod: { select: { kind: true } } } });
  return recurring ? { recurring, month: dateFromKey(`${month}-01`) } : null;
}

/** Changes the amount for one month only (for bills that vary, like electricity). */
export async function setOccurrenceAmount(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  if (!amountCents) return { fieldErrors: { amount: "amount" } };
  const owned = await findOwnedRecurring(userId, formData);
  if (!owned) return { error: "generic" };

  const override = amountCents === owned.recurring.amountCents ? null : amountCents;
  await db.recurringOccurrence.upsert({
    where: { recurringPaymentId_month: { recurringPaymentId: owned.recurring.id, month: owned.month } },
    create: { userId, recurringPaymentId: owned.recurring.id, month: owned.month, amountCents: override },
    update: { amountCents: override },
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Marks a cash recurring payment paid or unpaid for one month. Card payments follow their statement instead. */
export async function setOccurrencePaid(formData: FormData) {
  const userId = await requireActionUserId();
  const owned = await findOwnedRecurring(userId, formData);
  if (!owned || owned.recurring.paymentMethod.kind !== "CASH") return;

  const paidAt = formData.get("paid") === "true" ? new Date() : null;
  await db.recurringOccurrence.upsert({
    where: { recurringPaymentId_month: { recurringPaymentId: owned.recurring.id, month: owned.month } },
    create: { userId, recurringPaymentId: owned.recurring.id, month: owned.month, paidAt },
    update: { paidAt },
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function setStatementPaid(formData: FormData) {
  const userId = await requireActionUserId();
  const paymentMethodId = readText(formData, "paymentMethodId");
  const month = readText(formData, "statementMonth");
  if (!isUuid(paymentMethodId) || !isMonthKey(month)) return;

  const card = await db.paymentMethod.findFirst({ where: { id: paymentMethodId, userId, kind: "CARD" }, select: { id: true } });
  if (!card) return;

  const statementMonth = dateFromKey(`${month}-01`);
  if (formData.get("paid") === "true") {
    await db.statementPayment.upsert({
      where: { paymentMethodId_statementMonth: { paymentMethodId, statementMonth } },
      create: { userId, paymentMethodId, statementMonth },
      update: {},
    });
  } else {
    await db.statementPayment.deleteMany({ where: { userId, paymentMethodId, statementMonth } });
  }
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
