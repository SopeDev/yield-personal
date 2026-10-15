import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LEGAL_UPDATED, legalDocument } from "@/content/legal";
import type { Locale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { formatLongDate } from "@/lib/dates";
import { dateFromKey } from "@/lib/months";

/** The privacy notice or the terms of use, readable whether or not you're signed in, each linking to the other. */
export function LegalPage({ kind, locale }: { kind: "privacy" | "terms"; locale: Locale }) {
  const document = legalDocument(kind, locale);
  const m = getDictionary(locale).legal;
  const other = kind === "privacy" ? "terms" : "privacy";
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <Link className="-ml-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground" href={`/${locale}/month`}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          {m.back}
        </Link>
        <Image alt="Yield" height={22} src="/brand/yield-logo.svg" width={72} />
      </div>
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{document.title}</h1>
        <p className="text-sm text-muted-foreground">{format(m.updated, { date: formatLongDate(dateFromKey(LEGAL_UPDATED), locale) })}</p>
        <p className="text-lg text-muted-foreground">{document.intro}</p>
      </header>
      {document.sections.map((section) => (
        <section className="space-y-3" key={section.heading}>
          <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => <p className="leading-relaxed text-foreground/90" key={paragraph}>{paragraph}</p>)}
          {section.items ? (
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-foreground/90">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </section>
      ))}
      <p className="border-t border-border pt-6 text-sm">
        <Link className="font-medium text-primary" href={`/${locale}/${other}`}>{m[other]}</Link>
      </p>
    </main>
  );
}
