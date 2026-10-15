"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { seal } from "@/db/encryption";
import { isCurrency, parseAmountToCents } from "@/lib/money";
import { dateFromKey, dateKeyOf, isDateKey } from "@/lib/months";
import { parseSchedule } from "@/lib/onboarding";
import { getMainCurrency } from "@/lib/queries";
import { recurringIncomeRhythmOf } from "@/lib/recurring-income";
import { addDays } from "@/lib/forecast";
import { DEPOSIT_MATCH_DAYS, depositDays, matchDeposits, parseRatePercent } from "@/lib/savings-growth";
import { todayKey } from "@/lib/today";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

const MAX_NAME_LENGTH = 40;
const MAX_NOTE_LENGTH = 200;
const MIN_COVER_MONTHS = 1;
const MAX_COVER_MONTHS = 24;

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return z.uuid().safeParse(value).success;
}

/** Records a deposit into (or withdrawal from) a savings fund. A client-generated `clientId` makes retries safe. */
export async function createSavingsMovement(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const fundId = readText(formData, "fundId");
  const amountCents = parseAmountToCents(readText(formData, "amount"));
  const direction = readText(formData, "direction");
  const date = readText(formData, "date");
  const note = readText(formData, "note");
  const clientId = readText(formData, "clientId");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  if (!isDateKey(date)) fieldErrors.date = "date";
  if (direction !== "deposit" && direction !== "withdraw") fieldErrors.direction = "generic";
  if (note.length > MAX_NOTE_LENGTH) fieldErrors.note = "generic";
  if (!isUuid(fundId)) return { error: "generic" };
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const fund = await db.savingsFund.findFirst({ where: { id: fundId, userId, archivedAt: null }, select: { id: true } });
  if (!fund) return { error: "generic" };

  const id = isUuid(clientId) ? clientId : undefined;
  const existing = id ? await db.savingsMovement.findUnique({ where: { id }, select: { userId: true } }) : null;
  if (existing && existing.userId !== userId) return { error: "generic" };
  if (!existing) {
    await db.savingsMovement.create({
      data: { id, userId, fundId, date: dateFromKey(date), ...seal("SavingsMovement", { amountCents: direction === "deposit" ? amountCents! : -amountCents!, note: note || null }) },
    });
  }

  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

export async function deleteSavingsMovement(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.savingsMovement.deleteMany({ where: { id, userId } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function createGoalFund(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  const targetCents = parseAmountToCents(readText(formData, "target"));

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name || name.length > MAX_NAME_LENGTH) fieldErrors.name = "name";
  if (!targetCents) fieldErrors.target = "amount";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // A goal saves in one currency, moved from and to that currency's cash wallet.
  const currency = readText(formData, "currency") || await getMainCurrency(userId);
  if (!isCurrency(currency)) return { fieldErrors: { currency: "generic" } };
  await db.savingsFund.create({ data: { userId, kind: "GOAL", ...seal("SavingsFund", { name, targetCents }), currency } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** The emergency fund sets how many months of spending it covers; goals set a name and a target amount. */
export async function updateSavingsFund(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const fund = await db.savingsFund.findFirst({ where: { id, userId }, select: { kind: true } });
  if (!fund) return { error: "generic" };

  if (fund.kind === "EMERGENCY") {
    const coverMonths = Number(readText(formData, "coverMonths"));
    if (!Number.isInteger(coverMonths) || coverMonths < MIN_COVER_MONTHS || coverMonths > MAX_COVER_MONTHS) return { fieldErrors: { coverMonths: "coverMonths" } };
    await db.savingsFund.update({ where: { id }, data: { coverMonths } });
  } else {
    const name = readText(formData, "name");
    const targetCents = parseAmountToCents(readText(formData, "target"));
    const fieldErrors: FormState["fieldErrors"] = {};
    if (!name || name.length > MAX_NAME_LENGTH) fieldErrors.name = "name";
    if (!targetCents) fieldErrors.target = "amount";
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
    await db.savingsFund.update({ where: { id }, data: seal("SavingsFund", { name, targetCents }) });
  }

  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return {};
}

/** Goals can be archived; the emergency fund always exists. */
export async function archiveGoalFund(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return;
  await db.savingsFund.updateMany({ where: { id, userId, kind: "GOAL" }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/**
 * Sets how a fund grows: its annual interest rate (a percentage; blank for none), optionally until a day with the rate
 * after it, and a planned deposit (an amount and how often; blank amount for none), which the forecast moves from cash
 * into the fund on its days.
 */
export async function setFundGrowth(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!isUuid(id)) return { error: "generic" };
  const fund = await db.savingsFund.findFirst({ where: { id, userId, archivedAt: null }, select: { id: true } });
  if (!fund) return { error: "generic" };

  const fieldErrors: FormState["fieldErrors"] = {};
  const rateText = readText(formData, "rate");
  const rate = rateText === "" ? null : parseRatePercent(rateText);
  if (rateText !== "" && rate === null) fieldErrors.rate = "rate";
  const until = readText(formData, "until");
  const afterText = readText(formData, "after");
  const after = afterText === "" ? null : parseRatePercent(afterText);
  if (until !== "" && (!isDateKey(until) || rate === null)) fieldErrors.until = "date";
  if (until !== "" && after === null && afterText !== "0") fieldErrors.after = "rate";
  const depositText = readText(formData, "deposit");
  const depositCents = depositText === "" ? null : parseAmountToCents(depositText);
  if (depositText !== "" && depositCents === null) fieldErrors.deposit = "amount";
  const schedule = depositCents === null ? null : parseSchedule(readText(formData, "schedule"), readText(formData, "days"), readText(formData, "anchor"));
  if (depositCents !== null && schedule === null) fieldErrors.schedule = "payDays";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  await db.savingsFund.update({
    where: { id },
    data: {
      interestRateBps: rate,
      interestUntil: until === "" ? null : dateFromKey(until),
      interestAfterBps: until === "" ? null : (after ?? 0),
      ...seal("SavingsFund", { depositCents }),
      depositRhythm: schedule?.kind ?? null,
      depositAnchor: schedule && schedule.kind !== "MONTH_DAYS" ? dateFromKey(schedule.anchor) : null,
      depositDays: schedule?.kind === "MONTH_DAYS" ? schedule.days : [],
    },
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

/**
 * Records a planned deposit as made: its fund's planned amount (or `amount`), dated its planned day (or `date`, from 3
 * days before it to 10 after, the days a deposit counts for it); made ahead of its day, it's dated today.
 */
export async function confirmPlannedDeposit(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const fundId = readText(formData, "fundId");
  const planned = readText(formData, "planned");
  if (!isUuid(fundId) || !isDateKey(planned)) return { error: "generic" };
  const fund = await db.savingsFund.findFirst({
    where: { id: fundId, userId, archivedAt: null },
    select: { depositCents: true, depositRhythm: true, depositAnchor: true, depositDays: true, movements: { select: { date: true, amountCents: true } } },
  });
  const rhythm = fund?.depositRhythm ? recurringIncomeRhythmOf({ kind: fund.depositRhythm, anchor: fund.depositAnchor ? dateKeyOf(fund.depositAnchor) : null, days: fund.depositDays }) : null;
  if (!fund?.depositCents || !rhythm) return { error: "generic" };
  // A day already made (a second tap, or a screen from before it was) records nothing more.
  const month = planned.slice(0, 7);
  const days = depositDays(rhythm, `${month}-01`, `${month}-31`);
  const made = matchDeposits(days, fund.movements.map((movement) => ({ date: dateKeyOf(movement.date), amountCents: movement.amountCents })));
  if (!days.includes(planned)) return { error: "generic" };
  if (made.get(planned)) return { savedAt: Date.now() };
  const amountText = readText(formData, "amount");
  const amountCents = amountText === "" ? fund.depositCents : parseAmountToCents(amountText);
  const today = todayKey();
  const date = readText(formData, "date") || (planned <= today ? planned : today);
  const fieldErrors: FormState["fieldErrors"] = {};
  if (!amountCents) fieldErrors.amount = "amount";
  // Only a day the deposit counts for (see matchDeposits) makes it.
  if (!isDateKey(date) || date < addDays(planned, -DEPOSIT_MATCH_DAYS.before) || date > addDays(planned, DEPOSIT_MATCH_DAYS.after)) fieldErrors.date = "date";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  await db.savingsMovement.create({ data: { userId, fundId, date: dateFromKey(date), ...seal("SavingsMovement", { amountCents: amountCents!, note: null }) } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
  return { savedAt: Date.now() };
}

/** The one-tap check on a planned deposit's row: made as planned. */
export async function quickConfirmPlannedDeposit(formData: FormData) {
  await confirmPlannedDeposit({}, formData);
}
