import { notFound } from "next/navigation";
import { SubpageHeader } from "@/components/settings-layout";
import { Card } from "@/components/section";
import { db } from "@/db/client";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getAppTimeZone } from "@/lib/env";
import { isOwner } from "@/lib/owner";

/** How many of the latest messages the inbox lists. */
const INBOX_SIZE = 100;

/** The feedback users have sent, newest first, for the app's owner (`OWNER_EMAIL`) only; anyone else gets a 404. */
export default async function FeedbackInboxPage({ params }: PageProps<"/[locale]/feedback/inbox">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  if (!await isOwner(await requireUserId(locale))) notFound();
  const messages = getDictionary(locale);
  const m = messages.feedback;
  const feedback = await db.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: INBOX_SIZE,
    select: { id: true, message: true, appVersion: true, locale: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: getAppTimeZone() });

  return (
    <div className="space-y-6">
      <SubpageHeader backHref={`/${locale}/feedback`} backLabel={m.title} title={m.inboxTitle} />
      {feedback.length === 0 ? <Card className="px-4 py-6 text-center text-muted-foreground">{m.inboxEmpty}</Card> : (
        <Card>
          <ul className="divide-y divide-border">
            {feedback.map((entry) => (
              <li className="space-y-1 px-4 py-3" key={entry.id}>
                <p className="text-xs text-muted-foreground">
                  {when.format(entry.createdAt)} · v{entry.appVersion} · {entry.locale}
                </p>
                <p className="whitespace-pre-wrap text-sm">{entry.message}</p>
                <p className="text-xs text-subtle">
                  {entry.user.name ?? ""}{entry.user.email ? <> · <a className="text-primary" href={`mailto:${entry.user.email}`}>{entry.user.email}</a></> : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
