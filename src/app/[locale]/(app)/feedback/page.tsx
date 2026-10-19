import Link from "next/link";
import { FeedbackForm } from "@/components/feedback-form";
import { LEGAL_CONTACT } from "@/content/legal";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { APP_VERSION_SHORT } from "@/lib/app-version";
import { requireUserId } from "@/lib/auth-user";
import { isOwner } from "@/lib/owner";

/** Feedback for the app's owner: a personal note about the project, the form, and email as another way to write. */
export default async function FeedbackPage({ params }: PageProps<"/[locale]/feedback">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const m = messages.feedback;

  return (
    <div className="space-y-6">
      {/* A note, not a box: anything boxed right above the form reads as another field. */}
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">{m.title}</h1>
        <div className="space-y-2 border-l-2 border-primary/60 pl-3 text-sm text-muted-foreground">
          <p>{m.intro}</p>
          <p>{m.introAsk}</p>
          <p className="text-subtle">{m.signature}</p>
        </div>
      </div>
      <FeedbackForm locale={locale} messages={messages} />
      <p className="text-sm text-muted-foreground">
        {m.orEmail} <a className="font-medium text-primary" href={`mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent(format(m.emailSubject, { version: APP_VERSION_SHORT }))}`}>{LEGAL_CONTACT}</a>
      </p>
      {await isOwner(userId) ? <Link className="block text-sm font-medium text-primary" href={`/${locale}/feedback/inbox`}>{m.inboxLink}</Link> : null}
    </div>
  );
}
