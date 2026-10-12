"use server";

import { z } from "zod";
import { db } from "@/db/client";
import { getDictionary } from "@/i18n/dictionaries";
import { defaultLocale, isLocale } from "@/i18n/config";
import { sendToUser } from "@/lib/due-reminders";
import { requireActionUserId } from "./action-user";

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Saves this device's push subscription, so its reminders come in the language it was turned on in. */
export async function saveSubscription(subscription: unknown, locale: string) {
  const userId = await requireActionUserId();
  const { endpoint, keys } = subscriptionSchema.parse(subscription);
  const language = isLocale(locale) ? locale : defaultLocale;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, locale: language },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, locale: language },
  });
}

/** Forgets this device, so it gets no more reminders. */
export async function deleteSubscription(endpoint: string) {
  const userId = await requireActionUserId();
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/** Sends a test notification to the user's devices; returns how many it reached. */
export async function sendTestNotification() {
  const userId = await requireActionUserId();
  return sendToUser(userId, (stored) => {
    const locale = isLocale(stored) ? stored : defaultLocale;
    const messages = getDictionary(locale).notifications;
    return { title: messages.testTitle, body: messages.testBody, url: `/${locale}/month`, tag: "test" };
  });
}
