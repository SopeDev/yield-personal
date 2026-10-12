import { sendDueReminders } from "@/lib/due-reminders";
import { todayKey } from "@/lib/today";

/**
 * Called each morning by Vercel Cron (`vercel.json`), which signs the request with `CRON_SECRET`: reminds everyone
 * with notifications on of their unpaid payments due in the next few days.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const notified = await sendDueReminders(todayKey());
  return Response.json({ notified });
}
