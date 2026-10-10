"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { isIncomeRhythmKind, paydaysInMonth, parsePayDays } from "@/lib/income-rhythm";
import { resolveIncomeSource } from "@/lib/income-source-resolution";
import { isCurrency, parseAmountToCents } from "@/lib/money";
import { dateFromKey, dateKeyOf, isDateKey, type MonthKey } from "@/lib/months";
import { getMainCurrency } from "@/lib/queries";
import { recurringIncomeRhythmOf, recurringIncomeStart, type RecurringIncomeRhythm } from "@/lib/recurring-income";
import { todayKey } from "@/lib/today";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

/** The stored form of a schedule. */
function rhythmColumns(rhythm: RecurringIncomeRhythm) {
  return {
    rhythm: rhythm.kind,
    anchor: rhythm.kind === "MONTH_DAYS" ? null : dateFromKey(rhythm.anchor),
    payDays: rhythm.kind === "MONTH_DAYS" ? rhythm.days : [],
  };
}

/** Amount, currency, and schedule (weekly ones from a payday, or days of the month); the source is resolved last. */
async function parseRecurringIncome(userId: string, formData: FormData, { isEdit }: { isEdit: boolean }) {
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const kind = readText(formData, "kind");
  const anchor = readText(formData, "anchor");
  const days = parsePayDays(readText(formData, "days"));

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (kind === "WEEKLY" || kind === "BIWEEKLY") {
    if (!isDateKey(anchor)) fieldErrors.anchor = "date";
  } else if (kind === "MONTH_DAYS") {
    if (!days) fieldErrors.days = "payDays";
  } else {
    fieldErrors.kind = "generic";
  }
  // Received into the cash wallet of its currency (the main currency when the form doesn't ask).
  const currency = readText(formData, "currency") || await getMainCurrency(userId);
  if (!isCurrency(currency)) fieldErrors.currency = "generic";
  if (Object.keys(fieldErrors).length > 0 || !isIncomeRhythmKind(kind)) return { fieldErrors };
  const rhythm = recurringIncomeRhythmOf({ kind, anchor, days: days ?? [] });
  if (!rhythm) return { fieldErrors: { kind: "generic" } as FormState["fieldErrors"] };

  const source = await resolveIncomeSource(userId, {
    sourceId: readText(formData, "sourceId"), sourceName: readText(formData, "sourceName"), groupId: "", allowArchived: isEdit,
  });
  if ("error" in source) return { fieldErrors: (source.error === "name" ? { sourceName: "name" } : { sourceId: "source" }) as FormState["fieldErrors"] };

  return { data: { sourceId: source.sourceId, amountCents: amountCents!, currency }, rhythm };
}

export async function createRecurringIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const parsed = await parseRecurringIncome(userId, formData, { isEdit: false });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const startsOn = recurringIncomeStart(parsed.rhythm, todayKey());
  await db.recurringIncome.create({ data: { userId, ...parsed.data, ...rhythmColumns(parsed.rhythm), startsOn: dateFromKey(startsOn) } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

/**
 * Edits apply to paydays not received yet. A new schedule counts from today (or its first payday still to come), so
 * paydays already passed under the old one aren't expected again.
 */
export async function updateRecurringIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const existing = await db.recurringIncome.findFirst({ where: { id, userId }, select: { rhythm: true, anchor: true, payDays: true, startsOn: true } });
  if (!existing) return { error: "generic" };
  const parsed = await parseRecurringIncome(userId, formData, { isEdit: true });
  if (!parsed.data) return { fieldErrors: parsed.fieldErrors };

  const columns = rhythmColumns(parsed.rhythm);
  const rescheduled = columns.rhythm !== existing.rhythm
    || columns.anchor?.getTime() !== existing.anchor?.getTime()
    || columns.payDays.join() !== existing.payDays.join();
  const startsOn = rescheduled ? dateFromKey(recurringIncomeStart(parsed.rhythm, todayKey())) : existing.startsOn;
  await db.recurringIncome.update({ where: { id }, data: { ...parsed.data, ...columns, startsOn } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Stops a recurring income: its paydays stop being expected; income already received stays recorded. */
export async function stopRecurringIncome(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.recurringIncome.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/**
 * Records the income received for one of this month's paydays, which stops it counting as expected. It is dated on
 * the payday, or today when it arrives early. Receiving the same payday again does nothing.
 */
export async function receiveRecurringIncome(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  if (!amountCents) return { fieldErrors: { amount: "amount" } };
  const id = readText(formData, "recurringIncomeId");
  const payday = readText(formData, "payday");
  if (!isUuid(id) || !isDateKey(payday)) return { error: "generic" };

  const recurring = await db.recurringIncome.findFirst({
    where: { id, userId },
    select: { sourceId: true, currency: true, rhythm: true, anchor: true, payDays: true, startsOn: true },
  });
  const rhythm = recurring && recurringIncomeRhythmOf({ kind: recurring.rhythm, anchor: recurring.anchor ? dateKeyOf(recurring.anchor) : null, days: recurring.payDays });
  const today = todayKey();
  // Only this month's paydays are received, as listed in the month view.
  if (!recurring || !rhythm || payday.slice(0, 7) !== today.slice(0, 7) || payday < dateKeyOf(recurring.startsOn)) return { error: "generic" };
  if (!paydaysInMonth(rhythm, payday.slice(0, 7) as MonthKey).includes(payday)) return { error: "generic" };

  await db.income.createMany({
    data: [{
      userId,
      sourceId: recurring.sourceId,
      amountCents,
      currency: recurring.currency,
      date: dateFromKey(payday <= today ? payday : today),
      recurringIncomeId: id,
      expectedOn: dateFromKey(payday),
    }],
    // One income per payday: a double tap or retry finds it already received.
    skipDuplicates: true,
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}
