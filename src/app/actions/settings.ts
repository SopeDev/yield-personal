"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { LOCALE_COOKIE } from "@/i18n/config";
import { CARD_COLORS, MAX_STATEMENT_DAY } from "@/lib/payment-methods";
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

export async function createCard(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const name = readText(formData, "name");
  const color = readText(formData, "color");
  const closingDay = readDay(formData, "closingDay");
  const dueDay = readDay(formData, "dueDay");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name || name.length > MAX_NAME_LENGTH) fieldErrors.name = "name";
  if (!(CARD_COLORS as readonly string[]).includes(color)) fieldErrors.color = "color";
  if (!closingDay) fieldErrors.closingDay = "day";
  if (!dueDay) fieldErrors.dueDay = "day";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  await db.paymentMethod.create({ data: { userId, kind: "CARD", name, color, closingDay, dueDay } });
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

export async function archiveIncomeSource(formData: FormData) {
  const userId = await requireActionUserId();
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(id).success) return;
  await db.incomeSource.updateMany({ where: { id, userId }, data: { archivedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

export async function setLocale(formData: FormData) {
  const locale = localeFromForm(formData);
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS, sameSite: "lax", path: "/" });
  redirect(`/${locale}/settings`);
}
