import "server-only";

import webpush from "web-push";
import { db } from "@/db/client";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, defaultLocale } from "@/i18n/config";
import { duePayments, dueReminder } from "@/lib/due-soon";
import { loadLedgerRange } from "@/lib/ledger-data";
import { summarizeMonth } from "@/lib/month-summary";
import { CARRY_UNPAID_MONTHS } from "@/lib/month-view";
import { addMonths, type MonthKey } from "@/lib/months";

/**
 * Unpaid payments due soon for a user: this month's and next month's recurring bills, unpaid bills and card
 * statements carried from earlier months (as the month view carries them), and statements due in the window.
 */
export async function loadDuePayments(userId: string, today: string) {
  const month = today.slice(0, 7) as MonthKey;
  const next = addMonths(month, 1);
  const carryFrom = addMonths(month, -CARRY_UNPAID_MONTHS);
  const { data, cards } = await loadLedgerRange(userId, month, next, { statementsFrom: carryFrom });
  const current = summarizeMonth(data, month, { carryFrom });
  return duePayments({
    today,
    occurrences: [...current.cashFlow.carriedOccurrences, ...current.occurrences, ...summarizeMonth(data, next).occurrences],
    statements: data.statements.filter((statement) => statement.month >= carryFrom),
    cardNames: new Map(cards.map((card) => [card.id, card.name])),
  });
}

/** Web Push signing keys, or null when they aren't configured (notifications are then off). */
function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { subject: process.env.VAPID_SUBJECT || "mailto:notifications@yield.app", publicKey, privateKey };
}

export type PushMessage = { title: string; body: string; url: string; tag: string };

/**
 * Sends a notification to each of the user's devices, removing those whose subscription has expired or been
 * revoked. Returns how many devices it reached.
 */
export async function sendToUser(userId: string, message: (locale: string) => PushMessage) {
  const vapid = vapidDetails();
  if (!vapid) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not configured");
  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message(subscription.locale)),
        { vapidDetails: vapid, TTL: 12 * 60 * 60 },
      );
      sent += 1;
    } catch (error) {
      // 404 and 410: the browser dropped this subscription, so it will never receive anything again.
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: subscription.id } });
      else console.error("Push failed", status, error);
    }
  }));
  return sent;
}

/** Reminds every user with notifications on of their unpaid payments due soon; users with none due get nothing. */
export async function sendDueReminders(today: string) {
  const users = await db.pushSubscription.findMany({ distinct: ["userId"], select: { userId: true } });
  let notified = 0;
  for (const { userId } of users) {
    const payments = await loadDuePayments(userId, today);
    if (payments.length === 0) continue;
    const currency = (await db.user.findUnique({ where: { id: userId }, select: { currency: true } }))?.currency ?? "MXN";
    await sendToUser(userId, (stored) => {
      const locale = isLocale(stored) ? stored : defaultLocale;
      return { ...dueReminder(payments, { messages: getDictionary(locale), mainCurrency: currency }), url: `/${locale}/month`, tag: "due-payments" };
    });
    notified += 1;
  }
  return notified;
}
