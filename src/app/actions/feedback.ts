"use server";

import { db } from "@/db/client";
import { seal } from "@/db/encryption";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { APP_VERSION } from "@/lib/app-version";
import { sendToUser } from "@/lib/due-reminders";
import { getOwnerEmail } from "@/lib/env";
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { localeFromForm, requireActionUserId } from "./action-user";
import type { FormState } from "./form-state";

/** More than this many messages a day from one account is a mistake or abuse, not feedback. */
const MAX_FEEDBACK_PER_DAY = 10;

/**
 * Saves a message for the app's owner and tells the owner's devices it arrived (when notifications are configured;
 * a failed notification never loses the message).
 */
export async function sendFeedback(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireActionUserId();
  const locale = localeFromForm(formData);
  const message = String(formData.get("message") ?? "").trim();
  if (!message || message.length > MAX_FEEDBACK_LENGTH) return { fieldErrors: { message: "generic" } };
  const recent = await db.feedback.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  if (recent >= MAX_FEEDBACK_PER_DAY) return { error: "generic" };

  await db.feedback.create({ data: { userId, ...seal("Feedback", { message }), appVersion: APP_VERSION, locale } });
  await notifyOwner().catch((error: unknown) => console.error("Feedback notification failed", error));
  return { savedAt: Date.now() };
}

async function notifyOwner() {
  const email = getOwnerEmail();
  if (!email || !process.env.VAPID_PRIVATE_KEY) return;
  const owner = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!owner) return;
  await sendToUser(owner.id, (stored) => {
    const locale = isLocale(stored) ? stored : defaultLocale;
    const m = getDictionary(locale).feedback;
    return { title: m.notificationTitle, body: m.notificationBody, url: `/${locale}/feedback/inbox`, tag: "feedback" };
  });
}
