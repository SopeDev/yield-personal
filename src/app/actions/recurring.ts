"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { resolveItem } from "@/lib/item-resolution";
import { parseAmountToCents } from "@/lib/money";
import { addMonths, dateFromKey, isMonthKey, monthKeyOf, type MonthKey } from "@/lib/months";
import { MAX_STATEMENT_DAY } from "@/lib/payment-methods";
import { lateChargeDate, MAX_INTERVAL_MONTHS, nextActiveMonth } from "@/lib/recurring";
import { currentMonthKey, todayKey } from "@/lib/today";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";


function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

async function parseRecurring(userId: string, formData: FormData) {
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const paymentMethodId = readText(formData, "paymentMethodId");
  const dayOfMonth = Number(readText(formData, "dayOfMonth"));
  const intervalMonths = Number(readText(formData, "intervalMonths") || "1");
  const isVariable = formData.get("isVariable") === "on";

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > MAX_INTERVAL_MONTHS) fieldErrors.intervalMonths = "interval";
  if (!isUuid(paymentMethodId)) fieldErrors.paymentMethodId = "paymentMethod";
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > MAX_STATEMENT_DAY) fieldErrors.dayOfMonth = "day";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const paymentMethod = await db.paymentMethod.findFirst({ where: { id: paymentMethodId, userId, archivedAt: null }, select: { id: true } });
  if (!paymentMethod) return { fieldErrors: { paymentMethodId: "paymentMethod" } as FormState["fieldErrors"] };

  const item = await resolveItem(userId, {
    itemId: readText(formData, "itemId"),
    itemName: readText(formData, "itemName"),
    categoryId: readText(formData, "categoryId"),
  });
  if ("error" in item) return { fieldErrors: (item.error === "item" ? { itemName: "item" } : { categoryId: "category" }) as FormState["fieldErrors"] };

  return { data: { itemId: item.itemId, amountCents: amountCents!, paymentMethodId, dayOfMonth, intervalMonths, isVariable } };
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
 * A bill every few months keeps its cycle: the new version starts at its next billing month.
 */
export async function updateRecurringPayment(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const recurring = await db.recurringPayment.findFirst({ where: { id, userId }, select: { startMonth: true, endMonth: true, intervalMonths: true } });
  if (!recurring) return { error: "generic" };

  const month = currentMonthKey();
  if (recurring.endMonth && monthKeyOf(recurring.endMonth) < month) return { error: "recurringEnded" };
  const parsed = await parseRecurring(userId, formData);
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  if (monthKeyOf(recurring.startMonth) >= month) {
    await db.recurringPayment.update({ where: { id }, data: parsed.data });
  } else {
    const thisMonth = dateFromKey(`${month}-01`);
    const keepsCycle = parsed.data.intervalMonths === recurring.intervalMonths;
    const nextStart = (keepsCycle && nextActiveMonth({ ...recurring, endMonth: null }, month)) || month;
    await db.$transaction(async (tx) => {
      await tx.recurringPayment.update({ where: { id }, data: { endMonth: dateFromKey(`${addMonths(month, -1)}-01`) } });
      const next = await tx.recurringPayment.create({
        data: { userId, ...parsed.data, startMonth: dateFromKey(`${nextStart}-01`), endMonth: recurring.endMonth },
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
  const recurring = await db.recurringPayment.findFirst({
    where: { id, userId },
    select: { id: true, amountCents: true, isVariable: true, dayOfMonth: true, paymentMethod: { select: { id: true, kind: true, currency: true } } },
  });
  return recurring ? { recurring, month: dateFromKey(`${month}-01`) } : null;
}

/**
 * Moves a recurring payment to another payment method from `month` on; earlier months keep the old one. A payment
 * that started before `month` is split like an edit: the old version ends the month before and a new version
 * (counted as added when the original was) continues from `month` with that month's and later changes.
 * Returns the id of the version that now holds `month`.
 */
async function switchPaymentMethodFrom(tx: Prisma.TransactionClient, recurringId: string, month: MonthKey, paymentMethodId: string) {
  const recurring = await tx.recurringPayment.findUniqueOrThrow({ where: { id: recurringId } });
  if (monthKeyOf(recurring.startMonth) >= month) {
    await tx.recurringPayment.update({ where: { id: recurringId }, data: { paymentMethodId } });
    return recurringId;
  }
  const monthStart = dateFromKey(`${month}-01`);
  await tx.recurringPayment.update({ where: { id: recurringId }, data: { endMonth: dateFromKey(`${addMonths(month, -1)}-01`) } });
  const next = await tx.recurringPayment.create({
    data: {
      userId: recurring.userId,
      itemId: recurring.itemId,
      paymentMethodId,
      amountCents: recurring.amountCents,
      isVariable: recurring.isVariable,
      intervalMonths: recurring.intervalMonths,
      dayOfMonth: recurring.dayOfMonth,
      startMonth: monthStart,
      endMonth: recurring.endMonth,
      createdAt: recurring.createdAt,
    },
    select: { id: true },
  });
  await tx.recurringOccurrence.updateMany({ where: { recurringPaymentId: recurringId, month: { gte: monthStart } }, data: { recurringPaymentId: next.id } });
  return next.id;
}

/**
 * Sets one month's amount and payment method: confirms a variable bill's real amount, or changes a fixed bill's
 * amount for that month only. A different payment method applies from that month on (see
 * `switchPaymentMethodFrom`); a bill switched to a card after its due date is charged on the day it was
 * switched. With `markPaid`, a cash bill is also marked paid in the same step.
 */
export async function setOccurrenceAmount(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  if (!amountCents) return { fieldErrors: { amount: "amount" } };
  const owned = await findOwnedRecurring(userId, formData);
  if (!owned) return { error: "generic" };
  const { recurring, month } = owned;
  const monthKey = monthKeyOf(month);

  const requestedMethodId = readText(formData, "paymentMethodId") || recurring.paymentMethod.id;
  const methodChanged = requestedMethodId !== recurring.paymentMethod.id;
  const method = methodChanged
    // Only to a method in the bill's currency: switching never converts the amount.
    ? await db.paymentMethod.findFirst({ where: { id: requestedMethodId, userId, archivedAt: null, currency: recurring.paymentMethod.currency }, select: { id: true, kind: true, currency: true } })
    : recurring.paymentMethod;
  if (!method) return { fieldErrors: { paymentMethodId: "paymentMethod" } };

  // A variable bill always stores the amount, since storing it is what confirms the month.
  const override = !recurring.isVariable && amountCents === recurring.amountCents ? null : amountCents;
  const paidAt = formData.get("markPaid") === "true" && method.kind === "CASH" ? new Date() : undefined;
  const methodChange = methodChanged
    ? {
      // Cash "paid" doesn't carry to a card, whose bills are paid with the statement.
      ...(method.kind === "CARD" ? { paidAt: null } : {}),
      chargedOn: method.kind === "CARD" ? lateChargeDate(monthKey, recurring.dayOfMonth, dateFromKey(todayKey())) : null,
    }
    : {};
  await db.$transaction(async (tx) => {
    const recurringPaymentId = methodChanged ? await switchPaymentMethodFrom(tx, recurring.id, monthKey, method.id) : recurring.id;
    await tx.recurringOccurrence.upsert({
      where: { recurringPaymentId_month: { recurringPaymentId, month } },
      create: { userId, recurringPaymentId, month, amountCents: override, paidAt, ...methodChange },
      update: { amountCents: override, ...(paidAt ? { paidAt } : {}), ...methodChange },
    });
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
