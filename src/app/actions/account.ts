"use server";

import { signOut } from "@/auth";
import { db } from "@/db/client";
import { getDictionary } from "@/i18n/dictionaries";
import { localeFromForm, requireActionUserId } from "./action-user";

/**
 * Deletes the signed-in account and everything in it for good (every record belongs to the user and goes with it),
 * once the confirmation word for the language is typed, then signs out to the sign-in screen.
 */
export async function deleteAccount(_state: { mismatch?: boolean }, formData: FormData): Promise<{ mismatch?: boolean }> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const word = getDictionary(locale).account.confirmWord;
  if (String(formData.get("confirm") ?? "").trim().toLocaleUpperCase(locale) !== word) return { mismatch: true };
  await db.user.delete({ where: { id: userId } });
  await signOut({ redirectTo: `/${locale}/sign-in?deleted=1` });
  return {};
}
